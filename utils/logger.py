import logging
import os
from logging.handlers import RotatingFileHandler

def setup_logger(name: str) -> logging.Logger:
    """
    Returns a configured logger with a rotating file handler and a console stream.
    Creates a 'logs' directory if one does not exist.
    """
    # Create logs directory at project root
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    log_dir = os.path.join(base_dir, "logs")
    if not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)
        
    log_file = os.path.join(log_dir, "awarex.log")
    
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # Prevent adding handlers multiple times if instantiated repeatedly
    if not logger.handlers:
        # 1. Rotating File Handler (Max 5MB per file, keep last 3)
        file_handler = RotatingFileHandler(
            log_file, 
            maxBytes=5 * 1024 * 1024, 
            backupCount=3,
            encoding="utf-8"
        )
        
        # 2. Console Handler
        console_handler = logging.StreamHandler()
        
        # Consistent Formatter: Notice %(name)s explicitly identifies the calling module
        formatter = logging.Formatter(
            '%(asctime)s | [%(name)s] | %(levelname)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
        # Do not propagate up to root logger to avoid double-printing
        logger.propagate = False
        
    return logger
