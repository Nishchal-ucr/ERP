from flask import Flask
from flask_cors import CORS

from api import register_blueprints
from config import Config
from db.schema import initialize_schema
from db.seed import seed_data


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
    register_blueprints(app)

    @app.get("/")
    def root():
        return "Hello World!"

    return app


if __name__ == "__main__":
    initialize_schema()
    seed_data()
    app = create_app()
    app.run(host="0.0.0.0", port=Config.PORT, debug=True)
