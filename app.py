import time
from flask import Flask, render_template, request, jsonify
import data_manager
from engine import TimetableEngine

app = Flask(__name__)

CURRENT_TIMETABLE = []
CURRENT_FITNESS = 0
CURRENT_HARD_VIOLATIONS = []
CURRENT_SOFT_VIOLATIONS = []
CURRENT_TRAJECTORY = []
CURRENT_ANALYTICS = {}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/data", methods=["GET"])
def get_data():
    data = data_manager.load_data()
    return jsonify({
        "status": "success",
        "data": data,
        "current_timetable": CURRENT_TIMETABLE,
        "fitness": CURRENT_FITNESS,
        "hard_violations": CURRENT_HARD_VIOLATIONS,
        "soft_violations": CURRENT_SOFT_VIOLATIONS,
        "trajectory": CURRENT_TRAJECTORY,
        "analytics": CURRENT_ANALYTICS
    })

@app.route("/api/data", methods=["POST"])
def update_data():
    req_data = request.json
    if not req_data:
        return jsonify({"status": "error", "message": "No data provided"}), 400
    data_manager.save_data(req_data)
    return jsonify({"status": "success", "message": "Data saved successfully"})

@app.route("/api/reset", methods=["POST"])
def reset_data():
    req_json = request.json or {}
    preset_type = req_json.get("preset", "university")
    data = data_manager.reset_to_default(preset_type)
    
    global CURRENT_TIMETABLE, CURRENT_FITNESS, CURRENT_HARD_VIOLATIONS, CURRENT_SOFT_VIOLATIONS, CURRENT_TRAJECTORY, CURRENT_ANALYTICS
    CURRENT_TIMETABLE = []
    CURRENT_FITNESS = 0
    CURRENT_HARD_VIOLATIONS = []
    CURRENT_SOFT_VIOLATIONS = []
    CURRENT_TRAJECTORY = []
    CURRENT_ANALYTICS = {}
    return jsonify({"status": "success", "message": f"Reset to {preset_type} sample preset", "data": data})

@app.route("/api/generate", methods=["POST"])
def generate_timetable():
    global CURRENT_TIMETABLE, CURRENT_FITNESS, CURRENT_HARD_VIOLATIONS, CURRENT_SOFT_VIOLATIONS, CURRENT_TRAJECTORY, CURRENT_ANALYTICS

    req_json = request.json or {}
    pop_size = int(req_json.get("pop_size", 60))
    generations = int(req_json.get("generations", 200))
    mutation_rate = float(req_json.get("mutation_rate", 0.2))

    data = data_manager.load_data()
    engine = TimetableEngine(data)

    start_time = time.time()
    best_chrom, fit, h_v, s_v, trajectory, analytics = engine.solve(
        pop_size=pop_size,
        max_generations=generations,
        mutation_rate=mutation_rate
    )
    exec_time = round(time.time() - start_time, 3)

    CURRENT_TIMETABLE = best_chrom
    CURRENT_FITNESS = fit
    CURRENT_HARD_VIOLATIONS = h_v
    CURRENT_SOFT_VIOLATIONS = s_v
    CURRENT_TRAJECTORY = trajectory
    CURRENT_ANALYTICS = analytics

    return jsonify({
        "status": "success",
        "timetable": best_chrom,
        "fitness": fit,
        "hard_violations": h_v,
        "soft_violations": s_v,
        "execution_time_seconds": exec_time,
        "trajectory": trajectory,
        "analytics": analytics
    })

@app.route("/api/validate", methods=["POST"])
def validate_timetable():
    req_json = request.json or {}
    timetable = req_json.get("timetable", [])
    data = data_manager.load_data()
    engine = TimetableEngine(data)

    fit, h_v, s_v = engine.evaluate(timetable)
    analytics = engine.compute_analytics(timetable)
    return jsonify({
        "status": "success",
        "fitness": fit,
        "hard_violations": h_v,
        "soft_violations": s_v,
        "analytics": analytics
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
