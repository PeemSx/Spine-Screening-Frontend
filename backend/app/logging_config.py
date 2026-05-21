import logging
from logging import Logger

LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
PROJECT_LOGGERS = ("app", "core", "models")


def configure_logging(level: str = "INFO") -> Logger:
    """
    Configure application logging without changing the global root logger.

    Uvicorn's reloader process also imports this app module. If we call
    `logging.basicConfig(level=INFO)` there, third-party loggers such as
    `watchfiles.main` start emitting their internal "N changes detected"
    messages, which looks like phantom reload activity. Keep logging scoped to
    this project instead.
    """
    resolved_level = getattr(logging, level.upper(), logging.INFO)
    formatter = logging.Formatter(LOG_FORMAT)

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    handler.setLevel(resolved_level)
    handler._ovcf_handler = True  # type: ignore[attr-defined]

    configured = []
    for logger_name in PROJECT_LOGGERS:
        logger = logging.getLogger(logger_name)
        logger.setLevel(resolved_level)
        logger.propagate = False

        existing_handlers = [
            existing for existing in logger.handlers if getattr(existing, "_ovcf_handler", False)
        ]
        if not existing_handlers:
            logger.addHandler(handler)
        else:
            for existing in existing_handlers:
                existing.setLevel(resolved_level)
                existing.setFormatter(formatter)

        configured.append(logger)

    logging.getLogger("watchfiles").setLevel(logging.WARNING)
    logging.getLogger("watchfiles.main").setLevel(logging.WARNING)
    logging.getLogger("watchfiles.watcher").setLevel(logging.WARNING)

    return configured[0]
