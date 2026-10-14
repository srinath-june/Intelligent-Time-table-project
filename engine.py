import random
import copy

class TimetableEngine:
    def __init__(self, data):
        self.days = data.get("days", [])
        self.periods = data.get("periods", [])
        self.rooms = {r["id"]: r for r in data.get("rooms", [])}
        self.teachers = {t["id"]: t for t in data.get("teachers", [])}
        self.subjects = {s["id"]: s for s in data.get("subjects", [])}
        self.classes = {c["id"]: c for c in data.get("classes", [])}

        self.required_slots = []
        self._build_required_slots()

    def _build_required_slots(self):
        slot_counter = 0
        for class_id, class_obj in self.classes.items():
            std_cnt = class_obj.get("student_count", 0)
            for subj_id in class_obj.get("subjects", []):
                subj_obj = self.subjects.get(subj_id)
                if not subj_obj:
                    continue
                freq = subj_obj.get("weekly_frequency", 1)

                eligible_teachers = [
                    t_id for t_id, t_obj in self.teachers.items()
                    if subj_id in t_obj.get("subjects", [])
                ]
                if not eligible_teachers:
                    eligible_teachers = list(self.teachers.keys())

                eligible_rooms = []
                req_type = subj_obj.get("subject_type", "Lecture")
                for r_id, r_obj in self.rooms.items():
                    if r_obj.get("room_type") == req_type and r_obj.get("capacity", 0) >= std_cnt:
                        eligible_rooms.append(r_id)
                if not eligible_rooms:
                    eligible_rooms = [
                        r_id for r_id, r_obj in self.rooms.items()
                        if r_obj.get("room_type") == req_type
                    ]
                if not eligible_rooms:
                    eligible_rooms = list(self.rooms.keys())

                for idx in range(freq):
                    slot_counter += 1
                    self.required_slots.append({
                        "slot_id": f"{class_id}_{subj_id}_{idx}_{slot_counter}",
                        "class_id": class_id,
                        "subject_id": subj_id,
                        "eligible_teachers": eligible_teachers,
                        "eligible_rooms": eligible_rooms
                    })

    def generate_random_chromosome(self):
        chromosome = []
        all_time_slots = [(d, p_idx) for d in self.days for p_idx in range(len(self.periods))]

        class_groups = {}
        for req in self.required_slots:
            class_groups.setdefault(req["class_id"], []).append(req)

        for class_id, reqs in class_groups.items():
            available_slots = list(all_time_slots)
            random.shuffle(available_slots)

            for req in reqs:
                if available_slots:
                    day, period_idx = available_slots.pop()
                else:
                    day = random.choice(self.days)
                    period_idx = random.randint(0, len(self.periods) - 1)

                teacher_id = random.choice(req["eligible_teachers"]) if req["eligible_teachers"] else None
                room_id = random.choice(req["eligible_rooms"]) if req["eligible_rooms"] else None

                chromosome.append({
                    "slot_id": req["slot_id"],
                    "class_id": req["class_id"],
                    "subject_id": req["subject_id"],
                    "teacher_id": teacher_id,
                    "room_id": room_id,
                    "day": day,
                    "period_idx": period_idx
                })

        return chromosome

    def evaluate(self, chromosome):
        hard_violations = []
        soft_violations = []

        teacher_occupancy = {}
        room_occupancy = {}
        class_occupancy = {}
        teacher_daily_count = {}
        class_day_subjects = {}

        for gene in chromosome:
            d = gene["day"]
            p = gene["period_idx"]
            t_id = gene["teacher_id"]
            r_id = gene["room_id"]
            c_id = gene["class_id"]
            s_id = gene["subject_id"]

            if t_id:
                if (t_id, d, p) in teacher_occupancy:
                    other_c = teacher_occupancy[(t_id, d, p)]
                    t_name = self.teachers.get(t_id, {}).get("name", t_id)
                    hard_violations.append(f"Teacher {t_name} double-booked on {d} P{p + 1} ({c_id} & {other_c})")
                else:
                    teacher_occupancy[(t_id, d, p)] = c_id
                
                teacher_daily_count.setdefault((t_id, d), 0)
                teacher_daily_count[(t_id, d)] += 1

            if r_id:
                if (r_id, d, p) in room_occupancy:
                    other_c = room_occupancy[(r_id, d, p)]
                    r_name = self.rooms.get(r_id, {}).get("name", r_id)
                    hard_violations.append(f"Room {r_name} double-booked on {d} P{p + 1} ({c_id} & {other_c})")
                else:
                    room_occupancy[(r_id, d, p)] = c_id

                room_obj = self.rooms.get(r_id, {})
                class_obj = self.classes.get(c_id, {})
                subj_obj = self.subjects.get(s_id, {})

                if class_obj.get("student_count", 0) > room_obj.get("capacity", 0):
                    r_name = room_obj.get("name", r_id)
                    hard_violations.append(f"Class {c_id} ({class_obj.get('student_count')} std) exceeds capacity of {r_name} ({room_obj.get('capacity')})")

                if subj_obj.get("subject_type") == "Lab" and room_obj.get("room_type") != "Lab":
                    r_name = room_obj.get("name", r_id)
                    hard_violations.append(f"Lab subject {subj_id} assigned to non-lab room {r_name}")

            if (c_id, d, p) in class_occupancy:
                other_s = class_occupancy[(c_id, d, p)]
                hard_violations.append(f"Class {c_id} double-booked on {d} P{p + 1} ({s_id} & {other_s})")
            else:
                class_occupancy[(c_id, d, p)] = s_id

            class_day_subjects.setdefault((c_id, d), []).append(s_id)

        for (t_id, d), count in teacher_daily_count.items():
            t_obj = self.teachers.get(t_id, {})
            max_h = t_obj.get("max_hours_per_day", 4)
            if count > max_h:
                t_name = t_obj.get("name", t_id)
                soft_violations.append(f"Teacher {t_name} exceeds daily max ({count}/{max_h}) on {d}")

        for (c_id, d), s_list in class_day_subjects.items():
            from collections import Counter
            counts = Counter(s_list)
            for s_id, cnt in counts.items():
                if cnt > 2:
                    s_name = self.subjects.get(s_id, {}).get("name", s_id)
                    soft_violations.append(f"Class {c_id} has {s_name} {cnt} times on {d}")

        hard_score = len(hard_violations)
        soft_score = len(soft_violations)
        fitness = max(0, 1000 - (hard_score * 100) - (soft_score * 5))

        return fitness, hard_violations, soft_violations

    def smart_repair_and_mutate(self, chromosome):
        req_map = {req["slot_id"]: req for req in self.required_slots}
        all_time_slots = [(d, p_idx) for d in self.days for p_idx in range(len(self.periods))]

        teacher_occ = {}
        room_occ = {}
        class_occ = {}

        for gene in chromosome:
            teacher_occ.setdefault((gene["teacher_id"], gene["day"], gene["period_idx"]), []).append(gene)
            room_occ.setdefault((gene["room_id"], gene["day"], gene["period_idx"]), []).append(gene)
            class_occ.setdefault((gene["class_id"], gene["day"], gene["period_idx"]), []).append(gene)

        for gene in chromosome:
            c_id = gene["class_id"]
            t_id = gene["teacher_id"]
            r_id = gene["room_id"]
            d = gene["day"]
            p = gene["period_idx"]
            req = req_map.get(gene["slot_id"])

            is_conflicted = (
                len(teacher_occ.get((t_id, d, p), [])) > 1 or
                len(room_occ.get((r_id, d, p), [])) > 1 or
                len(class_occ.get((c_id, d, p), [])) > 1
            )

            if is_conflicted or random.random() < 0.1:
                class_used_slots = {
                    (g["day"], g["period_idx"]) for g in chromosome if g["class_id"] == c_id and g != gene
                }
                free_slots = [slot for slot in all_time_slots if slot not in class_used_slots]

                if free_slots:
                    new_d, new_p = random.choice(free_slots)
                    gene["day"] = new_d
                    gene["period_idx"] = new_p

                if req and req["eligible_rooms"]:
                    gene["room_id"] = random.choice(req["eligible_rooms"])
                if req and req["eligible_teachers"]:
                    gene["teacher_id"] = random.choice(req["eligible_teachers"])

    def crossover(self, parent1, parent2):
        child = []
        c_ids = list(self.classes.keys())
        half_c = set(random.sample(c_ids, len(c_ids) // 2)) if c_ids else set()

        for g1, g2 in zip(parent1, parent2):
            if g1["class_id"] in half_c:
                child.append(copy.deepcopy(g1))
            else:
                child.append(copy.deepcopy(g2))
        return child

    def compute_analytics(self, chromosome):
        teacher_hours = {}
        room_usage = {}
        class_workload = {}

        total_time_slots = len(self.days) * len(self.periods)

        for g in chromosome:
            t_id = g["teacher_id"]
            r_id = g["room_id"]
            c_id = g["class_id"]

            if t_id:
                t_name = self.teachers.get(t_id, {}).get("name", t_id)
                teacher_hours[t_name] = teacher_hours.get(t_name, 0) + 1

            if r_id:
                r_name = self.rooms.get(r_id, {}).get("name", r_id)
                room_usage[r_name] = room_usage.get(r_name, 0) + 1

            if c_id:
                c_name = self.classes.get(c_id, {}).get("name", c_id)
                class_workload[c_name] = class_workload.get(c_name, 0) + 1

        room_utilization = {}
        for r_id, r_obj in self.rooms.items():
            r_name = r_obj.get("name", r_id)
            used = room_usage.get(r_name, 0)
            pct = round((used / total_time_slots) * 100, 1) if total_time_slots else 0
            room_utilization[r_name] = {
                "used_slots": used,
                "total_slots": total_time_slots,
                "percentage": pct,
                "type": r_obj.get("room_type")
            }

        return {
            "teacher_hours": teacher_hours,
            "room_utilization": room_utilization,
            "class_workload": class_workload
        }

    def solve(self, pop_size=60, max_generations=200, mutation_rate=0.2):
        if not self.required_slots:
            return [], 0, ["No slots to schedule"], [], [], {}

        population = [self.generate_random_chromosome() for _ in range(pop_size)]

        best_chromosome = None
        best_fitness = -1
        best_h_viol = []
        best_s_viol = []
        trajectory = []

        for gen in range(max_generations):
            evaluated = []
            for chrom in population:
                fit, h_v, s_v = self.evaluate(chrom)
                evaluated.append((fit, chrom, h_v, s_v))
                if fit > best_fitness:
                    best_fitness = fit
                    best_chromosome = chrom
                    best_h_viol = h_v
                    best_s_viol = s_v

            trajectory.append({
                "generation": gen + 1,
                "fitness": best_fitness,
                "hard_violations": len(best_h_viol),
                "soft_violations": len(best_s_viol)
            })

            if best_fitness >= 1000 or len(best_h_viol) == 0:
                break

            evaluated.sort(key=lambda x: x[0], reverse=True)
            survivors_count = max(4, pop_size // 5)
            survivors = [item[1] for item in evaluated[:survivors_count]]

            new_population = [copy.deepcopy(survivors[0]), copy.deepcopy(survivors[1])]

            while len(new_population) < pop_size:
                p1 = random.choice(survivors)
                p2 = random.choice(survivors)
                child = self.crossover(p1, p2)

                if random.random() < mutation_rate or best_fitness < 900:
                    self.smart_repair_and_mutate(child)

                new_population.append(child)

            population = new_population

        fit, h_v, s_v = self.evaluate(best_chromosome)
        analytics = self.compute_analytics(best_chromosome)

        return best_chromosome, fit, h_v, s_v, trajectory, analytics
