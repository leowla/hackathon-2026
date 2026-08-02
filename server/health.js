import fs from "fs";

const HEALTH_FILE = "./character.json";
const DEFAULT_HEALTH = { health: 100, maxHealth: 100 };

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function getHealth() {
  const state = await readJson(HEALTH_FILE, DEFAULT_HEALTH);
  return {
    health:
      typeof state.health === "number" ? state.health : DEFAULT_HEALTH.health,
    maxHealth:
      typeof state.maxHealth === "number"
        ? state.maxHealth
        : DEFAULT_HEALTH.maxHealth,
  };
}

export async function applyDamage(damage) {
  const current = await getHealth();
  const next = {
    health: Math.max(0, Math.min(current.maxHealth, current.health - damage)),
    maxHealth: current.maxHealth,
  };
  await writeJson(HEALTH_FILE, next);
  return next;
}

export async function applyHeal(heal) {
  const current = await getHealth();
  const next = {
    health: Math.max(0, Math.min(current.maxHealth, current.health + heal)),
    maxHealth: current.maxHealth,
  };
  await writeJson(HEALTH_FILE, next);
  return next;
}

export async function resetHealth() {
  const current = await getHealth();
  const next = { health: current.maxHealth, maxHealth: current.maxHealth };
  await writeJson(HEALTH_FILE, next);
  return next;
}
