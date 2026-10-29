# VRCafe Takenlijst

Een todo-app met categorieën in de huisstijl van [VRCafe Haarlem](https://www.vrcafehaarlem.nl), gemaakt als stageopdracht.

**Live:** https://yevhentiutiunnyk.github.io/vrcafe-todo/

## Functionaliteit

### Musthaves
- Taken toevoegen met een categorie, als voltooid markeren en verwijderen
- Taken staan per categorie in een eigen sectie
- Vier vaste categorieën: **Werk**, **School**, **Persoonlijk** en **Vrije tijd**
- Alles wordt in **LocalStorage** bewaard, dus het blijft staan na het herladen
- Huisstijl van VRCafe: kleuren (paars, mint, roze, blauw), het lettertype Rubik, het logo en de looptekst
- Responsief: een **sidebar** op desktop en een **inklapbaar dropdownmenu** op mobiel
- Semantische HTML (`header`, `main`, `aside`, `nav`, `section`, `footer`), met HTML, CSS en JS in aparte bestanden

### Extra's
- Filteren op **Alle / Open / Voltooid**
- Sorteren op nieuwste, oudste, deadline of alfabet
- Hover-effecten en animaties bij het toevoegen, voltooien en verwijderen van taken
- Een **donkere en lichte modus**, allebei in de huisstijl
- **Eigen categorieën** toevoegen en verwijderen
- Een **voortgangsbalk** per categorie
- **Drag-and-drop**: sleep een taak naar een andere categorie (in de sidebar of op het bord)
- Een **deadline** kiezen met een datumprikker, plus een **(mock) agenda** per maand
- Verwijderen ongedaan maken via een melding
- Toegankelijk: ARIA-labels, focusstijlen, een skip-link en ondersteuning voor `prefers-reduced-motion`

## Structuur

```
index.html        de opmaak (semantische HTML)
css/style.css     de huisstijl, de thema's en de responsieve layout
js/storage.js     LocalStorage en de standaarddata
js/app.js         de state, het renderen en de interacties
```

## Lokaal draaien

Er is geen build-stap nodig. Open `index.html` of start een simpele server:

```bash
python3 -m http.server 8000
```

Ga daarna naar http://localhost:8000.
