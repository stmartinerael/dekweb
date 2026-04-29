#!/usr/bin/env node
import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const RECIPES_FILE = join(ROOT, 'recipes.json');
const PUBLIC_DIR = join(ROOT, 'recipes-app');

const app = express();
const PORT = process.env.PORT || 7777;

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function loadRecipes() {
  if (!existsSync(RECIPES_FILE)) return [];
  try {
    return JSON.parse(readFileSync(RECIPES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveRecipes(recipes) {
  writeFileSync(RECIPES_FILE, JSON.stringify(recipes, null, 2));
}

app.get('/api/recipes', (req, res) => {
  const recipes = loadRecipes();
  const { q, category } = req.query;
  let result = recipes;
  if (category && category !== 'all') {
    result = result.filter(r => r.category === category);
  }
  if (q) {
    const term = q.toLowerCase();
    result = result.filter(r =>
      r.title.toLowerCase().includes(term) ||
      (r.description || '').toLowerCase().includes(term)
    );
  }
  res.json(result);
});

app.get('/api/recipes/:id', (req, res) => {
  const recipes = loadRecipes();
  const recipe = recipes.find(r => r.id === req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Not found' });
  res.json(recipe);
});

app.post('/api/recipes', (req, res) => {
  const recipes = loadRecipes();
  const recipe = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: req.body.title || 'Untitled',
    description: req.body.description || '',
    category: req.body.category || 'Other',
    servings: req.body.servings || 1,
    prepTime: req.body.prepTime || 0,
    cookTime: req.body.cookTime || 0,
    ingredients: req.body.ingredients || [],
    instructions: req.body.instructions || [],
  };
  recipes.push(recipe);
  saveRecipes(recipes);
  res.status(201).json(recipe);
});

app.put('/api/recipes/:id', (req, res) => {
  const recipes = loadRecipes();
  const idx = recipes.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  recipes[idx] = {
    ...recipes[idx],
    ...req.body,
    id: recipes[idx].id,
    createdAt: recipes[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  saveRecipes(recipes);
  res.json(recipes[idx]);
});

app.delete('/api/recipes/:id', (req, res) => {
  const recipes = loadRecipes();
  const idx = recipes.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  recipes.splice(idx, 1);
  saveRecipes(recipes);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Recipe tracker running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
