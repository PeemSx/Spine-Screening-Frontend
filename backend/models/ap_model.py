import torch.nn as nn

from .dec_net import DecNet
from .hrnet import hrnet_w18_backbone


class APHRNetModel(nn.Module):
    def __init__(self, heads, final_kernel, head_conv):
        super(APHRNetModel, self).__init__()
        self.base_network = hrnet_w18_backbone(pretrained=False)
        self.dec_net = DecNet(
            heads=heads,
            final_kernel=final_kernel,
            head_conv=head_conv,
            encoder_channels=self.base_network.encoder_channels,
        )

    def forward(self, x):
        x = self.base_network(x)
        return self.dec_net(x)
