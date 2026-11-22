import os
import sys
from sqlalchemy import inspect

# Add current directory to path
sys.path.append(os.getcwd())

from app.infrastructure.database import Base, engine
# Import all entities to ensure SQLAlchemy knows about them
import app.models.entities.usuarios
import app.models.entities.favorites
import app.models.entities.favorite_lists
import app.models.entities.restaurant
import app.models.entities.rating
import app.models.entities.history
import app.models.entities.saved_for_later
import app.models.entities.rating_like

def init_db():
    print("== Checking database tables ==")
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    if not tables:
        print("No tables found. Creating all tables from SQLAlchemy models...")
        Base.metadata.create_all(bind=engine)
        print("Tables created successfully!")
        return True
    else:
        print(f"Existing tables found: {', '.join(tables)}")
        print("Skipping table creation.")
        return False

if __name__ == "__main__":
    if init_db():
        sys.exit(10)
    else:
        sys.exit(0)

