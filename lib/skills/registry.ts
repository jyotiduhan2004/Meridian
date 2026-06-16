import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { SkillMeta } from "@/lib/schema";

// Skills live in /skills at the project root. (For Vercel bundling, next.config
// includes ./skills/** in the server output file tracing.)
const SKILLS_DIR = path.join(process.cwd(), "skills");

export type LoadedSkill = { meta: SkillMeta; body: string };

function skillDirs(): string[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .filter((id) => fs.existsSync(path.join(SKILLS_DIR, id, "SKILL.md")));
}

function parse(id: string): LoadedSkill | null {
  const file = path.join(SKILLS_DIR, id, "SKILL.md");
  if (!fs.existsSync(file)) return null;
  const g = matter(fs.readFileSync(file, "utf8"));
  const parsed = SkillMeta.safeParse({ ...g.data, name: g.data.name ?? id });
  if (!parsed.success) return null;
  return { meta: parsed.data, body: g.content };
}

/** Lightweight index: frontmatter only (the registry). */
export function loadRegistry(): SkillMeta[] {
  return skillDirs()
    .map((id) => parse(id)?.meta)
    .filter((m): m is SkillMeta => Boolean(m));
}

/** Progressive disclosure: load the full body only when a skill is invoked. */
export function loadSkill(id: string): LoadedSkill | null {
  return parse(id);
}
