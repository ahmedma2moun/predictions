import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/football-predictions';

// Inline models to avoid Next.js module issues
const UserSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true }, password: String,
  role: { type: String, default: 'user' }, avatarUrl: String,
}, { timestamps: true });

const ScoringRuleSchema = new mongoose.Schema({
  name: String, description: String, key: { type: String, unique: true },
  points: Number, priority: Number, isActive: { type: Boolean, default: true },
}, { timestamps: true });

const User = mongoose.models.users_prediction || mongoose.model('users_prediction', UserSchema);
const ScoringRule = mongoose.models.ScoringRule || mongoose.model('ScoringRule', ScoringRuleSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Create admin user
  const existingAdmin = await User.findOne({ email: 'admin@predictions.app' });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash('changeme123', 12);
    await User.create({ name: 'Admin', email: 'admin@predictions.app', password: hashed, role: 'admin' });
    console.log('Admin user created');
  } else {
    console.log('Admin user already exists');
  }

  // Seed scoring rules
  const rules = [
    { name: 'Correct Winner/Draw', description: 'Predicted winner matches actual winner (home/away/draw)', key: 'correct_winner', points: 2, priority: 1, isActive: true },
    { name: 'Exact Score', description: 'Both predicted scores match exactly', key: 'exact_score', points: 5, priority: 2, isActive: true },
    { name: 'Correct Score Difference', description: 'Goal difference matches (e.g., predicted 3-1, actual 2-0)', key: 'score_difference', points: 3, priority: 3, isActive: true },
    { name: 'One Team Correct Score', description: 'Either the predicted home score or away score matches the actual', key: 'one_team_score', points: 1, priority: 4, isActive: true },
  ];

  for (const rule of rules) {
    await ScoringRule.updateOne({ key: rule.key }, { $setOnInsert: rule }, { upsert: true });
  }
  console.log('Scoring rules seeded');

  await mongoose.disconnect();
  console.log('Done');
}

seed().catch((e) => { console.error(e); process.exit(1); });
