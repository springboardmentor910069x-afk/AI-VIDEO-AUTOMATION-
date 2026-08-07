import logging
import sys

from app.core.config import get_settings


def setup_logging() -> logging.Logger:
    settings = get_settings()

    logging.basicConfig(
        level=settings.LOG_LEVEL,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
    )

    logger = logging.getLogger("app")
    logger.setLevel(settings.LOG_LEVEL)

    for name in ("uvicorn", "sqlalchemy", "alembic"):
        logging.getLogger(name).setLevel(logging.WARNING)

    return logger


logger = setup_logging()
