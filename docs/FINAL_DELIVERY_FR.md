# KnowledgeOS Enterprise — livraison locale, 2 novembre 2026

KnowledgeOS est une reconstruction de portfolio indépendante, inspirée d'une expérience de stage. Les documents et les identités de démonstration sont fictifs. Ce n'est ni une application officielle IAWEB.DEV, ni un déploiement client réel, ni un service multi-tenant certifié.

## Ouvrir la démonstration

Les services sont déjà démarrés. Après un redémarrage de la machine :

```sh
cd /home/timsilo/Desktop/hussin/knowledgeos-enterprise-rag
docker compose up -d
```

Ne remplace pas le `.env` déjà configuré et n'utilise jamais `docker compose down -v` pour résoudre un problème.

| Service | Adresse locale | Accès |
|---|---|---|
| Console administrateur | http://localhost:8080 | Compte personnel existant, mot de passe non partagé |
| Portail fictif Atlas | http://127.0.0.1:8090 | Sélecteur de personas explicitement synthétiques |
| FastAPI | http://localhost:8000 | Routes administrateur protégées ; `/api/v1` exige ses propres credentials |
| OpenAPI | http://localhost:8080/api/docs | Session administrateur via le proxy de la console |
| PostgreSQL | localhost:5433 | Connexion serveur locale |
| Qdrant | localhost:6333 | Service local de vecteurs, à ne pas exposer publiquement |

Les noms d'hôte admin/portail diffèrent volontairement : les cookies ne sont pas isolés par numéro de port.

### Parcours de cinq minutes

1. Ouvre la console, connecte-toi avec ton compte existant. Si tu dois créer un autre compte avec un accès opérateur local, utilise `docker compose exec backend python -m app.admin_cli` et sa saisie masquée ; aucun mot de passe par défaut n'existe.
2. Dans Knowledge Base, ouvre **Atlas demonstration — employee handbook**, puis les onglets texte, chunks et métadonnées. Son indexation est réelle.
3. Dans Integrations, ouvre **Atlas fictional employee portal**. Son périmètre contient uniquement ce manuel synthétique. Les 20 anciens documents sont conservés et restent privés. Ne révèle pas le secret pendant une présentation.
4. Ouvre http://127.0.0.1:8090, sélectionne Camille Demo, ouvre le chatbot en bas à droite et pose : **What is the remote work policy?**
5. Montre la réponse Gemini et ouvre les sources. Les trois jours de télétravail et les heures 10:00–16:00 viennent du document fictif, pas de connaissances générales du modèle.
6. Pose : **What is the exact monthly employee pension contribution rate?** Le corpus ne définit pas ce chiffre : la réponse doit s'abstenir.
7. Recharge le portail et rouvre l'historique. Déconnecte-toi puis sélectionne Samir Demo : l'historique de Camille ne doit pas être accessible à Samir.
8. Reviens à la console : les compteurs, modes, latences et activité par intégration proviennent des événements réellement enregistrés. Les questions des employés sont expurgées dans ces événements.

La sélection de personas est une simulation d'identité clairement indiquée. Pour une vraie entreprise, le backend du portail doit authentifier ses employés via son SSO et attester leur sujet ; KnowledgeOS ne remplace pas cet annuaire.

## Ajouter une vraie pièce de démonstration

Dans Knowledge Base, importe un PDF avec texte, TXT UTF-8 ou Markdown synthétique. Attends le statut `indexed`. Le pipeline effectue extraction, découpage, embeddings MiniLM et indexation Qdrant.

Un nouvel import est privé par défaut. Pour l'utiliser dans le portail, publie explicitement le document dans **Integrations → Employee document availability**, puis ajoute-le au périmètre de l'intégration Atlas. Ces deux contrôles sont nécessaires. Reindexation et suppression restent protégées ; supprimer un document retire ses vecteurs. Les conversations employé contenant une ancienne source désormais interdite sont masquées plutôt que rendues accessibles par leur historique.

## Gemini effectivement utilisé

Le modèle sélectionné est **`gemini-3.5-flash-lite`**. L'accès à ses métadonnées a renvoyé HTTP 200 avec support `generateContent`. Une vraie génération fondée sur le retrieval MiniLM/Qdrant a passé la validation des citations. Le parcours navigateur du portail final a également vérifié une réponse `grounded`, les sources, l'abstention et l'isolation des personas.

La clé Google reste dans le `.env` local ignoré par Git et dans l'environnement du backend. Aucun appel Google ne part du navigateur. Le secret d'intégration du portail reste côté serveur ; le widget reçoit un jeton opaque de cinq minutes conservé en mémoire.

Le quota restant et le niveau de facturation du projet ne sont pas accessibles par cette vérification. Consulte Google AI Studio pour ces informations ; une réponse HTTP 200 ne prouve pas une gratuité illimitée. Aucun autre modèle ni niveau payant n'a été sélectionné automatiquement.

Pour une nouvelle vérification explicite, qui consomme une requête fournisseur :

```sh
make gemini-verify
```

Les premières réponses réelles fournissaient les références JSON sans les marqueurs `[n]` dans le texte ; le validateur les a refusées. Les consignes et descriptions du schéma ont été précisées. Le validateur n'a pas été assoupli. Les citations valides contrôlent la forme et l'appartenance des sources ; elles ne garantissent pas à elles seules la vérité de chaque phrase.

## Données et migrations

Les migrations additives `0002_admin_auth` et `0003_enterprise_integrations` sont appliquées. Aucun reset, changement de modèle d'embeddings ou remplacement de collection Qdrant n'a été effectué.

- 20 documents historiques et leurs 100 chunks/vecteurs restent inchangés.
- Un manuel synthétique Atlas a été ajouté volontairement : le total est donc **21 documents, 103 chunks et 103 vecteurs**.
- Le compte administrateur personnel est conservé. Les comptes temporaires des vérifications ont été supprimés.
- Les conversations et événements réellement créés par les essais expliquent les nouveaux compteurs. Ils ne sont pas des données analytiques inventées.
- Une sauvegarde PostgreSQL et un instantané des lignes/vecteurs ont été placés hors dépôt dans `~/.local/share/knowledgeos-backups/`, avec droits restreints. La comparaison après travaux confirme la conservation des données d'origine ; les fichiers uploadés ont aussi été vérifiés par SHA-256.

## Commandes utiles

```sh
docker compose ps
docker compose logs --tail 50 backend intranet
make real-services-test
make frontend-check
python3 -m unittest discover -s examples/intranet/tests -v
node widget/tests/widget-browser.unit.mjs
```

`make real-services-test` crée uniquement une base PostgreSQL de test temporaire et des collections Qdrant de test, puis les nettoie. Il ne réinitialise pas la base de l'application.

Tests navigateur utilisant des services réels et, si actif, le fournisseur réel :

```sh
make enterprise-acceptance
cd frontend
KNOWLEDGEOS_LIVE_E2E=1 CHROME_PATH=/usr/bin/google-chrome npx playwright test e2e/employee-portal.spec.ts
```

Le premier script importe puis supprime seulement ses propres fixtures et son compte temporaire. Des événements réels expurgés et une intégration de test révoquée/désactivée restent comme traces. Le test du portail conserve les conversations synthétiques des personas. Ces commandes ne sont pas des tests unitaires gratuits ou des réponses simulées.

## Points à connaître avant l'entretien

- Architecture mono-entreprise, plusieurs intégrations ; pas d'isolation multi-tenant revendiquée.
- Le portail d'exemple n'est pas un SSO de production. Les sessions du portail sont en mémoire ; les conversations sont persistées dans KnowledgeOS.
- Les embeddings anglais MiniLM n'ont pas été remplacés. La génération multilingue de Gemini ne résout pas le retrieval français.
- Un secret de portail volé permet d'attester des sujets dans son intégration. Un bearer court peut être rejoué jusqu'à expiration/révocation. HTTPS, contrôle du portail, rétention, supervision et durcissement restent nécessaires avant une vraie exposition.
- Pas de benchmark, audit de pénétration, certification, restauration complète testée ni garantie d'absence d'hallucinations.
- Le credential Atlas expire après 90 jours. Sa rotation/révocation est disponible dans Integrations ; une rotation exige de mettre à jour la valeur locale puis recréer le service intranet.

Lis [ENTERPRISE_INTERVIEW_FR.md](ENTERPRISE_INTERVIEW_FR.md) pour les explications et questions d'entretien, [TESTING.md](TESTING.md) pour les résultats exécutés, [ENTERPRISE_API.md](ENTERPRISE_API.md) pour l'API, et [WIDGET_INTEGRATION.md](WIDGET_INTEGRATION.md) pour les exemples HTML/React.

## Résultats et état Git

La suite backend finale a passé 82 tests ; les 26 tests frontend, lint, TypeScript et build de production passent. Les tests navigateur du portail final et du Playground ont chacun passé avec Gemini réel. Le serveur portail passe quatre tests unitaires ; les contrôles du widget et de son exemple React passent aussi. Le rapport structuré est `verification-2026-11-02.json` ; les distinctions entre mocks et services réels, les échecs d'assertions corrigés et les limites sont détaillés dans `TESTING.md`.

Les changements sont enregistrés dans des commits locaux avec l'identité Git existante. Aucun push GitHub, changement d'identité ou de visibilité du dépôt n'a été effectué. Le `.env` et `understand.md` sont exclus du suivi. Relis le pitch français, vérifie ton accès administrateur personnel et garde les questions de démonstration en anglais avant de présenter.
