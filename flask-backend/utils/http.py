from flask import jsonify


def ok(payload, status=200):
    return jsonify(payload), status


def error(message: str, status: int):
    label_map = {
        400: "Bad Request",
        401: "Unauthorized",
        404: "Not Found",
        500: "Internal Server Error",
    }
    return (
        jsonify(
            {
                "message": message,
                "error": label_map.get(status, "Error"),
                "statusCode": status,
            }
        ),
        status,
    )
