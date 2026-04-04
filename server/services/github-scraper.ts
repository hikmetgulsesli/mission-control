/**
 * GitHub Scraper Service — shared utility for fetching repo metadata.
 * Used by both prd-generator and scrape routes.
 * Uses async child_process to avoid blocking the event loop.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface GitHubRepoData {
  name: string;
  fullName: string;
  description: string;
  language: string;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  license: string;
  homepage: string;
  defaultBranch: string;
  readme: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  techStack: string[];
  url: string;
}

async function ghApi(endpoint: string): Promise<any> {
  try {
    const { stdout } = await execFileAsync("gh", ["api", endpoint, "--cache", "1h"], {
      timeout: 15000,
      encoding: "utf-8",
    });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function detectTechStack(deps: Record<string, string>): string[] {
  const stack: string[] = [];
  const map: Record<string, string> = {
    react: "React", "react-dom": "React", next: "Next.js", vue: "Vue",
    nuxt: "Nuxt", angular: "Angular", svelte: "Svelte", express: "Express",
    fastify: "Fastify", koa: "Koa", hono: "Hono", vite: "Vite",
    webpack: "Webpack", tailwindcss: "Tailwind CSS", "@tailwindcss/postcss": "Tailwind CSS",
    prisma: "Prisma", drizzle: "Drizzle", mongoose: "Mongoose",
    typescript: "TypeScript", "react-native": "React Native", expo: "Expo",
    flutter: "Flutter", electron: "Electron", tauri: "Tauri",
    "socket.io": "Socket.IO", graphql: "GraphQL", trpc: "tRPC",
    zustand: "Zustand", redux: "Redux", jotai: "Jotai",
    jest: "Jest", vitest: "Vitest", playwright: "Playwright", cypress: "Cypress",
  };
  for (const [pkg, label] of Object.entries(map)) {
    if (deps[pkg]) stack.push(label);
  }
  return [...new Set(stack)];
}

export async function scrapeGitHubRepo(url: string): Promise<GitHubRepoData | null> {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (!match) return null;

  const [, owner, repo] = match;
  const repoName = repo.replace(/\.git$/, "");

  // Fetch repo metadata
  const repoData = await ghApi(`repos/${owner}/${repoName}`);
  if (!repoData) return null;

  // Fetch README
  let readme = "";
  try {
    const readmeData = await ghApi(`repos/${owner}/${repoName}/readme`);
    if (readmeData?.content) {
      readme = Buffer.from(readmeData.content, "base64").toString("utf-8").slice(0, 5000);
    }
  } catch {}

  // Fetch package.json
  let dependencies: Record<string, string> = {};
  let devDependencies: Record<string, string> = {};
  try {
    const pkgData = await ghApi(`repos/${owner}/${repoName}/contents/package.json`);
    if (pkgData?.content) {
      const pkg = JSON.parse(Buffer.from(pkgData.content, "base64").toString("utf-8"));
      dependencies = pkg.dependencies || {};
      devDependencies = pkg.devDependencies || {};
    }
  } catch {}

  const allDeps = { ...dependencies, ...devDependencies };
  const techStack = detectTechStack(allDeps);

  return {
    name: repoData.name,
    fullName: repoData.full_name,
    description: repoData.description || "",
    language: repoData.language || "",
    topics: repoData.topics || [],
    stars: repoData.stargazers_count ?? 0,
    forks: repoData.forks_count ?? 0,
    openIssues: repoData.open_issues_count ?? 0,
    license: repoData.license?.spdx_id || "",
    homepage: repoData.homepage || "",
    defaultBranch: repoData.default_branch || "main",
    readme,
    dependencies,
    devDependencies,
    techStack,
    url: repoData.html_url,
  };
}

export function detectPlatform(techStack: string[]): "web" | "mobile" | "desktop" {
  if (techStack.includes("React Native") || techStack.includes("Expo") || techStack.includes("Flutter")) return "mobile";
  if (techStack.includes("Electron") || techStack.includes("Tauri")) return "desktop";
  return "web";
}
