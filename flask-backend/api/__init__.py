from api.daily_reports_routes import daily_reports_bp
from api.flock_routes import flock_bp
from api.lookup_routes import lookup_bp
from api.user_routes import user_bp


def register_blueprints(app):
    app.register_blueprint(user_bp)
    app.register_blueprint(lookup_bp)
    app.register_blueprint(daily_reports_bp)
    app.register_blueprint(flock_bp)
