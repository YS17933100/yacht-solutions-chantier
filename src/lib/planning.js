// ============================================================
// Algorithme de planification automatique — Yacht Solutions
// Règles métier :
// - 6h effectives par jour
// - Lundi-vendredi uniquement
// - Continuité sur le même bateau (éviter les changements fréquents)
// - Respect des priorités (avant mise à l'eau, etc.)
// - Prise en compte des absences
// - Enchaînement des articles courts dans la même journée (3h+3h = 1 jour)
// ============================================================

const HOURS_PER_DAY = 6;
const WORK_DAYS = [1, 2, 3, 4, 5]; // Lundi à vendredi

export function isWorkDay(date) {
  const d = new Date(date);
  return WORK_DAYS.includes(d.getDay());
}

export function addWorkDays(date, days) {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (isWorkDay(d)) added++;
  }
  return d;
}

export function getWorkDaysBetween(start, end) {
  const days = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    if (isWorkDay(d)) {
      days.push(new Date(d).toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function isTechnicianAbsent(techId, date, absences) {
  return absences.some(a => {
    if (a.technician_id !== techId) return false;
    return date >= a.start_date && date <= a.end_date;
  });
}

export function canTechnicianDoTask(tech, task) {
  if (tech.specialty === 'libre') return true;
  const catMap = {
    electricite: 'elec_plomb',
    plomberie: 'elec_plomb',
    menuiserie: 'menuiserie',
    accastillage: 'elec_plomb',
    autre: 'elec_plomb',
  };
  return catMap[task.category] === tech.specialty;
}

// Planification automatique principale
export function generatePlanning({ boats, tasks, technicians, absences }) {
  // Structure: { techId: { date: { boatId, hours, taskIds } } }
  const schedule = {};
  technicians.forEach(t => { schedule[t.id] = {}; });

  const assignments = []; // { taskId, techId, date, plannedDate, plannedEndDate }

  // Trier les bateaux par date d'intervention start
  const activeboats = boats
    .filter(b => !b.archived && b.intervention_start && b.intervention_end)
    .sort((a, b) => new Date(a.intervention_start) - new Date(b.intervention_start));

  activeboats.forEach(boat => {
    const workDays = getWorkDaysBetween(boat.intervention_start, boat.intervention_end);

    // Tâches Yacht Solutions pour ce bateau, triées par priorité
    const boatTasks = tasks
      .filter(t => t.boat_id === boat.id && t.provider === 'Yacht Solutions' && t.status !== 'termine')
      .sort((a, b) => {
        if (a.is_priority && !b.is_priority) return -1;
        if (!a.is_priority && b.is_priority) return 1;
        return 0;
      });

    // Techniciens disponibles pour ce bateau
    const eligibleTechs = technicians.filter(t => t.specialty !== 'libre'); // Hendrik = manuel

    boatTasks.forEach(task => {
      const compatibleTechs = eligibleTechs.filter(t => canTechnicianDoTask(t, task));
      if (compatibleTechs.length === 0) return;

      let hoursLeft = Number(task.hours) || 0;
      let taskStartDate = null;
      let taskEndDate = null;

      // Chercher le premier jour disponible pour un technicien compatible
      for (const day of workDays) {
        if (hoursLeft <= 0) break;

        for (const tech of compatibleTechs) {
          if (isTechnicianAbsent(tech.id, day, absences)) continue;

          const daySchedule = schedule[tech.id][day] || { boatId: null, hours: 0, taskIds: [] };
          const availableHours = HOURS_PER_DAY - daySchedule.hours;
          if (availableHours <= 0) continue;

          // Préférer continuer sur le même bateau
          if (daySchedule.boatId && daySchedule.boatId !== boat.id && daySchedule.hours > 0) continue;

          const assignedHours = Math.min(hoursLeft, availableHours);
          if (!taskStartDate) taskStartDate = day;
          taskEndDate = day;
          hoursLeft -= assignedHours;

          schedule[tech.id][day] = {
            boatId: boat.id,
            hours: daySchedule.hours + assignedHours,
            taskIds: [...daySchedule.taskIds, task.id],
            techId: tech.id,
          };

          assignments.push({
            taskId: task.id,
            techId: tech.id,
            date: day,
            hours: assignedHours,
            boatId: boat.id,
            boatName: boat.name,
            taskName: task.name,
            category: task.category,
            totalHours: task.hours,
          });
          break;
        }
      }

      // Mettre à jour la tâche avec les dates planifiées
      if (taskStartDate) {
        task.planned_date = taskStartDate;
        task.planned_end_date = taskEndDate;
      } else {
        // Overflow — heures non planifiables dans la fenêtre
        task._overflow = true;
        task._overflowHours = hoursLeft;
      }
    });
  });

  return { schedule, assignments };
}

// Vérifier si un article est en retard (non validé après sa date planifiée)
export function getShiftedTasks(tasks, today) {
  return tasks.filter(t => {
    if (t.status === 'termine') return false;
    if (!t.planned_date) return false;
    return t.planned_date < today && !t.shift_accepted;
  });
}

// Calculer le taux d'occupation d'un technicien sur une période
export function getOccupationRate(techId, schedule, workDays) {
  const workedDays = workDays.filter(d => {
    const dayData = schedule[techId]?.[d];
    return dayData && dayData.hours > 0;
  });
  return workDays.length > 0 ? Math.round((workedDays.length / workDays.length) * 100) : 0;
}
