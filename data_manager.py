import json
import os

DATA_FILE = "timetable_data.json"

UNIVERSITY_PRESET = {
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "periods": [
        "08:30 - 09:30",
        "09:30 - 10:30",
        "10:30 - 11:30",
        "11:30 - 12:30",
        "13:30 - 14:30",
        "14:30 - 15:30"
    ],
    "rooms": [
        {"id": "LH-101", "name": "Auditorium 101", "capacity": 100, "room_type": "Lecture"},
        {"id": "LH-102", "name": "Lecture Hall 102", "capacity": 60, "room_type": "Lecture"},
        {"id": "LH-103", "name": "Lecture Hall 103", "capacity": 60, "room_type": "Lecture"},
        {"id": "LAB-CS1", "name": "AI & Software Lab", "capacity": 50, "room_type": "Lab"},
        {"id": "LAB-CS2", "name": "Networking Lab", "capacity": 50, "room_type": "Lab"},
        {"id": "LAB-PHY", "name": "Advanced Physics Lab", "capacity": 50, "room_type": "Lab"}
    ],
    "teachers": [
        {"id": "T1", "name": "Dr. Alan Turing", "max_hours_per_day": 4, "subjects": ["CS101", "CS301"]},
        {"id": "T2", "name": "Prof. Grace Hopper", "max_hours_per_day": 4, "subjects": ["CS102", "CS102L"]},
        {"id": "T3", "name": "Dr. Nikola Tesla", "max_hours_per_day": 4, "subjects": ["EE101", "EE101L"]},
        {"id": "T4", "name": "Dr. Ada Lovelace", "max_hours_per_day": 4, "subjects": ["MATH101", "MATH201"]},
        {"id": "T5", "name": "Prof. Marie Curie", "max_hours_per_day": 4, "subjects": ["PHY101", "PHY101L"]},
        {"id": "T6", "name": "Dr. Claude Shannon", "max_hours_per_day": 4, "subjects": ["CS201", "CS201L"]}
    ],
    "subjects": [
        {"id": "CS101", "code": "CS101", "name": "Intro to Programming", "weekly_frequency": 4, "subject_type": "Lecture"},
        {"id": "CS102", "code": "CS102", "name": "Data Structures", "weekly_frequency": 3, "subject_type": "Lecture"},
        {"id": "CS102L", "code": "CS102L", "name": "Data Structures Lab", "weekly_frequency": 2, "subject_type": "Lab"},
        {"id": "CS201", "code": "CS201", "name": "Database Systems", "weekly_frequency": 3, "subject_type": "Lecture"},
        {"id": "CS201L", "code": "CS201L", "name": "Database Lab", "weekly_frequency": 2, "subject_type": "Lab"},
        {"id": "CS301", "code": "CS301", "name": "Artificial Intelligence", "weekly_frequency": 3, "subject_type": "Lecture"},
        {"id": "MATH101", "code": "MATH101", "name": "Calculus & Algebra", "weekly_frequency": 4, "subject_type": "Lecture"},
        {"id": "MATH201", "code": "MATH201", "name": "Discrete Mathematics", "weekly_frequency": 3, "subject_type": "Lecture"},
        {"id": "EE101", "code": "EE101", "name": "Basic Electronics", "weekly_frequency": 3, "subject_type": "Lecture"},
        {"id": "EE101L", "code": "EE101L", "name": "Electronics Lab", "weekly_frequency": 2, "subject_type": "Lab"},
        {"id": "PHY101", "code": "PHY101", "name": "Applied Physics", "weekly_frequency": 3, "subject_type": "Lecture"},
        {"id": "PHY101L", "code": "PHY101L", "name": "Physics Practicum", "weekly_frequency": 2, "subject_type": "Lab"}
    ],
    "classes": [
        {"id": "CS-YEAR1", "name": "CS Year 1 (Sec A)", "student_count": 55, "subjects": ["CS101", "MATH101", "PHY101", "PHY101L"]},
        {"id": "CS-YEAR2", "name": "CS Year 2 (Sec A)", "student_count": 48, "subjects": ["CS102", "CS102L", "CS201", "CS201L", "MATH201"]},
        {"id": "CS-YEAR3", "name": "CS Year 3 (Sec A)", "student_count": 42, "subjects": ["CS301", "CS201", "MATH201", "EE101"]},
        {"id": "EE-YEAR1", "name": "EE Year 1 (Sec A)", "student_count": 45, "subjects": ["MATH101", "EE101", "EE101L", "PHY101", "PHY101L"]}
    ]
}

SCHOOL_PRESET = {
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "periods": ["09:00 - 09:45", "09:45 - 10:30", "10:45 - 11:30", "11:30 - 12:15", "13:00 - 13:45", "13:45 - 14:30"],
    "rooms": [
        {"id": "ROOM-10A", "name": "Classroom 10-A", "capacity": 40, "room_type": "Lecture"},
        {"id": "ROOM-10B", "name": "Classroom 10-B", "capacity": 40, "room_type": "Lecture"},
        {"id": "ROOM-11A", "name": "Classroom 11-A", "capacity": 40, "room_type": "Lecture"},
        {"id": "SCIENCE-LAB", "name": "Science Discovery Lab", "capacity": 40, "room_type": "Lab"},
        {"id": "COMP-LAB", "name": "Computer Tech Lab", "capacity": 40, "room_type": "Lab"}
    ],
    "teachers": [
        {"id": "T_MATH", "name": "Mr. Isaac Newton", "max_hours_per_day": 4, "subjects": ["MATH"]},
        {"id": "T_ENG", "name": "Ms. Emily Dickinson", "max_hours_per_day": 4, "subjects": ["ENG"]},
        {"id": "T_SCI", "name": "Dr. Galileo Galilei", "max_hours_per_day": 4, "subjects": ["SCI", "SCI_LAB"]},
        {"id": "T_HIST", "name": "Mr. Herodotus", "max_hours_per_day": 4, "subjects": ["HIST"]},
        {"id": "T_COMP", "name": "Ms. Charles Babbage", "max_hours_per_day": 4, "subjects": ["COMP", "COMP_LAB"]}
    ],
    "subjects": [
        {"id": "MATH", "code": "MATH", "name": "Mathematics", "weekly_frequency": 5, "subject_type": "Lecture"},
        {"id": "ENG", "code": "ENG", "name": "English Literature", "weekly_frequency": 4, "subject_type": "Lecture"},
        {"id": "SCI", "code": "SCI", "name": "General Science", "weekly_frequency": 4, "subject_type": "Lecture"},
        {"id": "SCI_LAB", "code": "SCI_LAB", "name": "Science Lab", "weekly_frequency": 2, "subject_type": "Lab"},
        {"id": "HIST", "code": "HIST", "name": "World History", "weekly_frequency": 3, "subject_type": "Lecture"},
        {"id": "COMP", "code": "COMP", "name": "Computer Studies", "weekly_frequency": 3, "subject_type": "Lecture"},
        {"id": "COMP_LAB", "code": "COMP_LAB", "name": "Computer Lab", "weekly_frequency": 2, "subject_type": "Lab"}
    ],
    "classes": [
        {"id": "GRADE-10A", "name": "Grade 10-A", "student_count": 35, "subjects": ["MATH", "ENG", "SCI", "SCI_LAB", "HIST", "COMP"]},
        {"id": "GRADE-10B", "name": "Grade 10-B", "student_count": 34, "subjects": ["MATH", "ENG", "SCI", "HIST", "COMP", "COMP_LAB"]},
        {"id": "GRADE-11A", "name": "Grade 11-A", "student_count": 38, "subjects": ["MATH", "ENG", "SCI", "SCI_LAB", "COMP", "COMP_LAB"]}
    ]
}

DEFAULT_DATA = UNIVERSITY_PRESET

def load_data():
    if not os.path.exists(DATA_FILE):
        save_data(DEFAULT_DATA)
        return DEFAULT_DATA
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        save_data(DEFAULT_DATA)
        return DEFAULT_DATA

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def reset_to_default(preset_type="university"):
    if preset_type == "school":
        preset = SCHOOL_PRESET
    else:
        preset = UNIVERSITY_PRESET
    save_data(preset)
    return preset
