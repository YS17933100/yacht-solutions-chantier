# Yacht Solutions — Carnet de chantier

## ÉTAPE 1 — Créer les tables dans Supabase

1. Va sur supabase.com → ton projet "Atelier Ys Brazza"
2. Dans le menu à gauche, clique sur l'icône **SQL Editor** (ressemble à un écran avec ">_")
3. Clique sur **New query**
4. Copie-colle tout le contenu du fichier `supabase/schema.sql`
5. Clique sur le bouton vert **Run**
6. Tu dois voir "Success" en bas

## ÉTAPE 2 — Installer et lancer sur ton ordinateur

Ouvre PowerShell dans le dossier du projet et tape ces commandes une par une :

```
npm install
npm run dev
```

Puis ouvre ton navigateur sur : http://localhost:3000

## ÉTAPE 3 — Mettre en ligne sur GitHub + Vercel

### Sur GitHub :
1. Crée un nouveau dépôt vide sur github.com (bouton "New repository")
2. Nomme-le "yacht-solutions-chantier"
3. Dans PowerShell, tape ces commandes :

```
git init
git add .
git commit -m "Première version"
git branch -M main
git remote add origin https://github.com/TON-COMPTE/yacht-solutions-chantier.git
git push -u origin main
```

### Sur Vercel :
1. Va sur vercel.com, connecte-toi avec GitHub
2. Clique "Add New" → "Project"
3. Sélectionne "yacht-solutions-chantier"
4. Dans "Environment Variables", ajoute :
   - Nom : NEXT_PUBLIC_SUPABASE_URL
   - Valeur : https://qnmnuziipblpnltjlzpu.supabase.co
   
   - Nom : NEXT_PUBLIC_SUPABASE_ANON_KEY
   - Valeur : sb_publishable_rQ8u2UQIxjA0PeEBaD2Qaw_1DGX9dXl

5. Clique "Deploy"
6. Dans 2-3 minutes ton site est en ligne !
