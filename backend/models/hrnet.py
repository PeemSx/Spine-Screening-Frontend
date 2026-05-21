import torch.nn as nn

try:
    import timm
except ImportError:
    timm = None


class HRNetBackbone(nn.Module):
    def __init__(self, model_name="hrnet_w18", pretrained=False):
        super(HRNetBackbone, self).__init__()
        if timm is None:
            raise ImportError(
                "HRNet backbone requires the 'timm' package. "
                "Install it before using backbone='hrnet_w18'."
            )

        self.backbone = timm.create_model(
            model_name,
            pretrained=pretrained,
            features_only=True,
            out_indices=(1, 2, 3, 4),
        )
        self.encoder_channels = list(self.backbone.feature_info.channels())

    def forward(self, x):
        return self.backbone(x)


def hrnet_w18_backbone(pretrained=False, **kwargs):
    return HRNetBackbone(model_name="hrnet_w18", pretrained=pretrained)
