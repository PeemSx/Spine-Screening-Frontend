import torch
import torch.nn as nn

from .model_parts import CombinationModule


def fill_head_weights(layers):
    for module in layers.modules():
        if isinstance(module, nn.Conv2d) and module.bias is not None:
            nn.init.constant_(module.bias, 0)


class DecNet(nn.Module):
    def __init__(self, heads, final_kernel, head_conv, encoder_channels):
        super(DecNet, self).__init__()
        if len(encoder_channels) != 4:
            raise ValueError("encoder_channels should have 4 elements, but got {}".format(len(encoder_channels)))

        c2, c3, c4, c5 = encoder_channels
        self.decoder_channels = [64, 128, 256, 512]
        d2, d3, d4, d5 = self.decoder_channels

        self.proj_c2 = nn.Sequential(
            nn.Conv2d(c2, d2, kernel_size=1, bias=False),
            nn.BatchNorm2d(d2),
            nn.ReLU(inplace=True),
        )
        self.proj_c3 = nn.Sequential(
            nn.Conv2d(c3, d3, kernel_size=1, bias=False),
            nn.BatchNorm2d(d3),
            nn.ReLU(inplace=True),
        )
        self.proj_c4 = nn.Sequential(
            nn.Conv2d(c4, d4, kernel_size=1, bias=False),
            nn.BatchNorm2d(d4),
            nn.ReLU(inplace=True),
        )
        self.proj_c5 = nn.Sequential(
            nn.Conv2d(c5, d5, kernel_size=1, bias=False),
            nn.BatchNorm2d(d5),
            nn.ReLU(inplace=True),
        )

        self.dec_c4 = CombinationModule(d5, d4, batch_norm=True)
        self.dec_c3 = CombinationModule(d4, d3, batch_norm=True)
        self.dec_c2 = CombinationModule(d3, d2, batch_norm=True)

        self.out_channel = d2
        self.heads = heads

        for head in self.heads:
            classes = self.heads[head]
            if head == "wh":
                fc = nn.Sequential(
                    nn.Conv2d(self.out_channel, head_conv, kernel_size=7, padding=7 // 2, bias=True),
                    nn.ReLU(inplace=True),
                    nn.Conv2d(head_conv, classes, kernel_size=7, padding=7 // 2, bias=True),
                )
            else:
                fc = nn.Sequential(
                    nn.Conv2d(self.out_channel, head_conv, kernel_size=3, padding=1, bias=True),
                    nn.ReLU(inplace=True),
                    nn.Conv2d(
                        head_conv,
                        classes,
                        kernel_size=final_kernel,
                        stride=1,
                        padding=final_kernel // 2,
                        bias=True,
                    ),
                )
            if "hm" in head:
                fc[-1].bias.data.fill_(-2.19)
            else:
                self.fill_fc_weights(fc)

            self.__setattr__(head, fc)

    def fill_fc_weights(self, layers):
        fill_head_weights(layers)

    def forward(self, x):
        if len(x) < 4:
            raise ValueError("Decoder expects at least 4 feature maps, but got {}".format(len(x)))

        p2 = self.proj_c2(x[-4])
        p3 = self.proj_c3(x[-3])
        p4 = self.proj_c4(x[-2])
        p5 = self.proj_c5(x[-1])

        c4_combine = self.dec_c4(p5, p4)
        c3_combine = self.dec_c3(c4_combine, p3)
        c2_combine = self.dec_c2(c3_combine, p2)
        dec_dict = {}
        for head in self.heads:
            dec_dict[head] = self.__getattr__(head)(c2_combine)
            if "hm" in head:
                dec_dict[head] = torch.sigmoid(dec_dict[head])
        return dec_dict
