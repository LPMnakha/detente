# Détente

Refuge 3D pour hypersensibles : une cabane en rondins, cosy, où l'on se balade au coin du feu.

- **Pièces** : salon avec cheminée, cuisine, chambre, salle de bain, coin lecture
- **Feu de cheminée** animé, avec un crépitement synthétisé qui s'adoucit quand on s'éloigne
- **Jour et nuit réels** : la position du soleil est calculée pour Paris, à l'heure actuelle

## Jouer

- **iPhone / navigateur** : https://lpmnakha.github.io/detente/
  (sur iPhone : Partager → « Sur l'écran d'accueil » pour l'ouvrir en plein écran)
- **Android** : télécharger `detente.apk` dans les [Releases](../../releases/tag/apk)

## Commandes

- Mobile : pouce gauche pour marcher, glisser à droite pour regarder
- Ordinateur : flèches ou ZQSD, cliquer-glisser pour regarder

Pour tester une autre heure : ajouter `?heure=21` ou `?heure=7:30` à l'adresse.

## Technique

- Three.js (r169, inclus dans `www/vendor`), sans étape de build : le dossier `www` est le site
- Textures et sons générés par le code, aucun fichier média
- `.github/workflows/pages.yml` publie `www` sur GitHub Pages
- `.github/workflows/android.yml` emballe `www` avec Capacitor et publie l'APK
- En local : `npx http-server www` puis ouvrir http://localhost:8080
