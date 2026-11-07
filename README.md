# Détente

Refuge 3D pour hypersensibles : une cabane en rondins, cosy, où l'on se balade au coin du feu.

- **Pièces** : salon avec cheminée, cuisine, chambre, salle de bain, coin lecture
- **Feu de cheminée** animé, avec un crépitement synthétisé qui s'adoucit quand on s'éloigne
- **Jour et nuit réels** : la position du soleil est calculée pour Paris, à l'heure actuelle
- **Dehors** : prairie, lac et montagnes façon Annecy, ponton et barque, forêt qui change avec les **saisons**
- **Météo en direct à Annecy** (Open-Meteo) : nuages, pluie, neige au sol, brouillard, vent dans les arbres, pluie sur le toit

## Romi

Romi, la chatte de la maison, vit sa vie : elle se promène, dort dans ses coins favoris (panier près du feu, étendoir, lit, banquette de la fenêtre, arbre à chat…), fait sa toilette, s'étire, joue avec la canne et vient te dire bonjour.

- **Caresser** : approche-toi et touche Romi, puis glisse le doigt sur elle (elle ronronne)
- **Jouer** : bouton « Jouer », puis fais glisser le ruban doré au sol devant elle
- **Gamelles** (cuisine) : touche une gamelle pour la remplir. Elle les vide au fil des heures, même appli fermée ; si elles sont vides, elle attend à côté, sans jamais être malade.

## Se poser

- **S'asseoir** : touche le canapé, le fauteuil près du feu, la banquette face au lac, le lit ou le banc de l'entrée. Glisse pour regarder autour de toi. Romi vient souvent se coucher sur tes genoux et ronronner (tu peux la caresser).
- **L'accueil** : en entrant, Romi vient te dire bonjour.
- **Les fêtes** : la cabane se décore toute seule — Épiphanie, Chandeleur, Saint-Valentin, Pâques, 14 juillet (lampions + feux d'artifice lointains), Halloween, Noël (1er déc. → 6 janv.), Nouvel An (feux d'artifice doux au-dessus du lac). Pour tester : `?fete=noel` (epiphanie, chandeleur, valentin, paques, juillet14, halloween, noel, nouvelan).

## Jouer

- **iPhone / navigateur** : https://lpmnakha.github.io/detente/
  (sur iPhone : Partager → « Sur l'écran d'accueil » pour l'ouvrir en plein écran)
- **Android** : télécharger `detente.apk` dans les [Releases](../../releases/tag/apk)

## Commandes

- Mobile : pouce gauche pour marcher, glisser à droite pour regarder
- Ordinateur : flèches ou ZQSD, cliquer-glisser pour regarder

Pour tester : ajouter à l'adresse `?heure=21`, `?saison=hiver` (printemps, ete, automne, hiver) ou `?meteo=pluie` (clair, nuageux, couvert, brouillard, pluie, averse, neige, orage). On peut combiner : `?heure=17&saison=hiver&meteo=neige`.

## Technique

- Three.js (r169, inclus dans `www/vendor`), sans étape de build : le dossier `www` est le site
- Textures et sons générés par le code, aucun fichier média
- GitHub Pages publie la branche `main` ; l'`index.html` racine renvoie vers `www/`
- `.github/workflows/android.yml` emballe `www` avec Capacitor et publie l'APK
- En local : `npx http-server www` puis ouvrir http://localhost:8080
