import logging
from logging import Logger


def configure_logging(level: str = "INFO") -> Logger:
    """
    Configure application logging with a consistent formatter.

    Returns the root logger so callers can further customise handlers if needed.
    """
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    return logging.getLogger("ovcf.backend")
