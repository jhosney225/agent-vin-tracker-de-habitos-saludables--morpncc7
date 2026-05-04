
```javascript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as readline from "readline";

const client = new Anthropic();
const DATA_FILE = "habits_data.json";

interface Habit {
  id: string;
  name: string;
  category: string;
  frequency: string;
  startDate: string;
  completions: Array<{
    date: string;
    completed: boolean;
  }>;
}

interface HabitsDatabase {
  habits: Habit[];
  lastUpdated: string;
}

// Load or initialize habits database
function loadHabitsDatabase(): HabitsDatabase {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(data);
  }
  return { habits: [], lastUpdated: new Date().toISOString() };
}

// Save habits database
function saveHabitsDatabase(db: HabitsDatabase): void {
  db.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// Add a new habit
function addHabit(
  name: string,
  category: string,
  frequency: string
): Habit {
  const habit: Habit = {
    id: Math.random().toString(36).substr(2, 9),
    name,
    category,
    frequency,
    startDate: new Date().toISOString().split("T")[0],
    completions: [],
  };
  return habit;
}

// Log habit completion
function logHabitCompletion(habit: Habit, date?: string): void {
  const completionDate = date || new Date().toISOString().split("T")[0];
  const existingCompletion = habit.completions.find(
    (c) => c.date === completionDate
  );

  if (!existingCompletion) {
    habit.completions.push({ date: completionDate, completed: true });
  } else {
    existingCompletion.completed = true;
  }
}

// Calculate statistics
function calculateStatistics(habit: Habit): {
  totalDays: number;
  completedDays: number;
  streak: number;
  completionRate: number;
} {
  const completedDays = habit.completions.filter((c) => c.completed).length;
  const totalDays = habit.completions.length || 1;
  const completionRate = (completedDays / totalDays) * 100;

  // Calculate current streak
  let streak = 0;
  const sortedCompletions = [...habit.completions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  for (const completion of sortedCompletions) {
    if (completion.completed) {
      streak++;
    } else {
      break;
    }
  }

  return {
    totalDays,
    completedDays,
    streak,
    completionRate: Math.round(completionRate),
  };
}

// Generate detailed statistics report
function generateStatisticsReport(db: HabitsDatabase): string {
  let report = "=== HEALTHY HABITS TRACKER STATISTICS ===\n\n";

  if (db.habits.length === 0) {
    return report + "No habits tracked yet. Start by adding a new habit!\n";
  }

  report += `Total Habits: ${db.habits.length}\n\n`;

  const categories: { [key: string]: number } = {};
  let totalStreak = 0;
  let overallCompletionRate = 0;

  db.habits.forEach((habit) => {
    const stats = calculateStatistics(habit);
    categories[habit.category] = (categories[habit.category] || 0) + 1;
    totalStreak += stats.streak;
    overallCompletionRate += stats.completionRate;

    report += `📌 ${habit.name}\n`;
    report += `   Category: ${habit.category}\n`;
    report += `   Frequency: ${habit.frequency}\n`;
    report += `   Started: ${habit.startDate}\n`;
    report += `   Completions: ${stats.completedDays}/${stats.totalDays}\n`;
    report += `   Current Streak: ${stats.streak} days\n`;
    report += `   Completion Rate: ${stats.completionRate}%\n\n`;
  });

  report += "=== SUMMARY ===\n";
  report += `Categories: ${Object.keys(categories).join(", ")}\n`;
  report += `Average Streak: ${Math.round(totalStreak / db.habits.length)} days\n`;
  report += `Overall Completion Rate: ${Math.round(overallCompletionRate / db.habits.length)}%\n`;

  return report;
}

// Process user input with Claude
async function processUserInput(
  userMessage: string,
  db: HabitsDatabase,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<{ response: string; updatedDb: HabitsDatabase }> {
  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  const systemPrompt = `You are a helpful healthy habits tracking assistant. 
The user wants to track and manage their daily habits and get statistics about them.

Current habits database:
${JSON.stringify(db, null, 2)}

You can help the user:
1. Add new habits (e.g., "I want to track drinking water daily")
2. Log completions (e.g., "I completed my exercise today")
3. Get statistics and insights about their habits
4. Provide motivation and tips

When the user wants to add a habit, extract:
- Habit name
- Category (health, fitness, learning, wellness, etc.)
- Frequency (daily, weekly, etc.)
Then respond with