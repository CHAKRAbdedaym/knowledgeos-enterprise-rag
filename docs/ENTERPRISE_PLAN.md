# Évolution Enterprise RAG-as-a-Service — architecture proposée

Progression locale : la première tranche d’authentification administrateur est maintenant implémentée ; voir [ADMIN_AUTH.md](ADMIN_AUTH.md). Les intégrations, le widget indépendant et Gemini restent à réaliser.

Statut du plan initial : inspection et conception. Ce document ne décrit pas des fonctionnalités déjà implémentées. Référence de départ : commit `6257abb`. Aucun push autorisé pour cette évolution. `understand.md` reste local et exclu de Git.

## Constat vérifié

Les quatre services Compose fonctionnent. Le dashboard retourne 20 documents indexés, 100 chunks, zéro conversation et zéro requête. Le fournisseur est `none`. L’encodeur est MiniLM local 384 dimensions. Les volumes et documents existants doivent être conservés.

`backend/app/routes.py` expose actuellement les documents, conversations, diagnostics et statistiques sans authentification. `security.py` gère les erreurs et un limiteur mémoire par IP, sans rôles. Les conversations ne portent aucun propriétaire. Les événements conservent les questions. La recherche Qdrant ne reçoit pas de filtre d’autorisation ; le filtrage SQL actuel vérifie seulement le statut d’indexation. Settings ne persiste que des préférences navigateur. Le widget React est intégré au shell administrateur et consomme les mêmes routes ouvertes. Il n’existe pas de fournisseur Gemini.

Le pipeline extraction/chunking/embeddings/Qdrant, les contrôles de révision, les citations, les migrations et le branding seront réutilisés. Les tests actuels utilisent des bases isolées et des embeddings déterministes uniquement en fixtures ; ils devront être adaptés pour authentifier leurs requêtes et couvrir les refus d’accès.

## Périmètre et acteurs

Première livraison : une entreprise par instance, sécurisée. Une organisation singleton identifie explicitement ce périmètre. Cette livraison ne revendiquera pas une isolation multi-tenant complète. Les futures organisations nécessiteront des contrôles et tests supplémentaires avant toute cohabitation de clients.

Trois identités distinctes : administrateur authentifié, intégration serveur possédant une clé révocable, employé représenté par un sujet authentifié par le portail. Un identifiant de conversation, d’entreprise ou d’employé envoyé seul par le navigateur ne confère aucun droit.

Les routes historiques `/api/documents`, `/api/conversations`, `/api/retrieval`, `/api/dashboard`, `/api/analytics` et `/api/config` restent compatibles en forme mais deviennent administrateur uniquement. La compatibilité ne signifie pas conserver un accès anonyme. Les endpoints détaillés readiness et OpenAPI administrateur sont également protégés ; seule une liveness minimale est publique. L’API employé possède ses propres contrats et n’appelle pas des endpoints admin au nom du navigateur.

## Authentification administrateur

Comptes SQL, mot de passe haché avec Argon2id via une bibliothèque maintenue, sessions opaques aléatoires dont seul le hash est conservé. Cookie HttpOnly, Secure en environnement HTTPS, SameSite, expiration et révocation serveur. Mode HTTP local explicitement borné au développement. Pas de jeton administrateur dans localStorage.

Contrôle CSRF sur les mutations utilisant les cookies : jeton lié à la session, header dédié et validation stricte de l’origine. Erreurs de connexion génériques, limitation des tentatives par identifiant et origine, session renouvelée à la connexion. Dépendance `require_admin` appliquée au routeur entier ; les tests énumèrent les routes pour détecter une route oubliée.

Initialisation du premier administrateur par commande serveur avec saisie masquée du mot de passe, sans inscription publique ni mot de passe par défaut commité. Logout révoque la session. Le frontend demande `/api/auth/me` avant de charger les données du dashboard et vide son cache à la déconnexion.

## Intégrations et permissions

Une clé permanente est générée une seule fois, affichée une seule fois à l’administrateur, puis stockée uniquement sous forme de hash avec préfixe d’identification. Elle possède une expiration, une révocation et des scopes explicites. Elle reste dans le backend du portail client.

Une intégration autorise explicitement tous les documents de l’organisation, ou une liste de documents. Une liste vide signifie aucun accès, jamais tous les documents. Les clés héritent de cette configuration serveur ; le client ne peut pas l’élargir en envoyant des IDs. Chaque requête contrôle la clé, l’intégration active, les scopes et l’expiration.

Le portail déduit `subject` de sa session/SSO côté serveur. Le backend KnowledgeOS fait confiance à ce portail autorisé pour attester ce sujet ; cette frontière de confiance est documentée. Le navigateur ne choisit pas librement ce sujet dans un endpoint de token public.

L’échange serveur délivre un jeton opaque court, par exemple cinq minutes, lié à l’intégration, au sujet, à l’origine autorisée et aux scopes. Seul son hash est conservé. Chaque appel vérifie aussi l’état courant de l’intégration : révoquer une clé/intégration invalide les accès associés sans attendre un JWT autonome expiré.

Les conversations employées sont rattachées à l’intégration ET au sujet. Lecture, ajout de message, renommage et suppression exigent ce propriétaire complet. L’administration ne partage pas ses conversations avec les employés. Une conversation existante antérieure à la migration reste réservée à l’administration.

## Contrats prévus

| Route | Identité | Usage |
|---|---|---|
| POST `/api/auth/login` | Anonyme, limité | Créer la session admin |
| GET `/api/auth/me` | Session admin | Identité et état de session |
| POST `/api/auth/logout` | Session + CSRF | Révocation |
| `/api/documents`, `/api/dashboard`, etc. | Admin | Contrats existants protégés |
| GET/PATCH `/api/admin/settings` | Admin + CSRF en écriture | Réglages validés, jamais de secrets |
| GET/POST `/api/admin/integrations` | Admin | Inventaire et création |
| POST `/api/admin/integrations/{id}/keys` | Admin | Émission de clé, affichage unique |
| DELETE `/api/admin/integrations/{id}/keys/{key_id}` | Admin | Révocation |
| PATCH `/api/admin/integrations/{id}` | Admin | Scopes, périmètre, origines, désactivation |
| POST `/api/v1/widget-sessions` | Clé serveur | Échange contre jeton employé court |
| POST `/api/v1/query` | Clé serveur avec sujet attesté, ou jeton court | Question autonome |
| GET/POST `/api/v1/conversations` | Principal employé | Historique propre et création |
| GET/DELETE `/api/v1/conversations/{id}` | Même propriétaire | Consultation/suppression |
| POST `/api/v1/conversations/{id}/messages` | Même propriétaire | Question et réponse persistantes |

Réponse de question : `answer`, `mode`, `conversation_id`, `sources`, `request_id`, timings utiles. Sources : identifiants document/chunk, titre, texte, page éventuelle, offsets et score. Les détails internes et chemins privés ne sont pas exposés. Erreurs avec code stable, message sûr et request_id ; 401 authentification, 403 permission, 404 ressource hors périmètre/non disponible, 429 limitation, 503 dépendance et 504 timeout selon la cause. Une erreur fournisseur ne sera pas présentée comme une réponse générée réussie.

La documentation d’intégration n’exposera que les contrats v1 aux entreprises. La documentation admin restera accessible avec une session appropriée.

## Recherche autorisée avant génération

Le service reçoit un principal résolu par le backend. SQL détermine les IDs de documents permis et indexés. Ces IDs servent de filtre Qdrant **pendant** le top-k ; un filtrage après recherche seul serait insuffisant et pourrait transmettre un document interdit au LLM.

Après Qdrant, SQL revérifie le périmètre et le statut, puis les sources autorisées construisent le contexte Gemini. Les sources historiques sont recontrôlées lors de la lecture : retirer un document du périmètre ne doit pas laisser son texte disponible dans les anciens messages/citations de l’employé. Les messages dont la réponse dépend d’une source désormais interdite seront masqués ou signalés indisponibles, plutôt que de révéler leur contenu conservé.

L’index existant possède déjà `metadata.document_id` : il est possible d’ajouter les ACL par filtre sur ces IDs sans supprimer ni recalculer ses vecteurs. L’organisation singleton et la vérification SQL bornent ce déploiement mono-entreprise. Un filtre organization_id seul serait dangereux tant que les anciens payloads ne le contiennent pas ; aucune migration partielle silencieuse ne sera utilisée comme garantie multi-tenant.

## Migrations additives prévues

Migration Alembic `0002` : organisation singleton ; comptes admin ; sessions admin ; intégrations ; clés hachées ; documents autorisés ; jetons widget courts ; configuration applicative ; audit de sécurité sans secret ; compteurs de limitation persistants si utilisés.

Ajouter aux conversations une organisation, un type de propriétaire, un administrateur éventuel ou une intégration/sujet, avec contraintes de cohérence. Ajouter aux événements le canal et l’intégration, sans déplacer les textes existants. Affecter les données historiques à l’organisation par défaut et au périmètre admin, sans les rendre visibles aux intégrations.

Backfill et contraintes sont ordonnés pour conserver les lignes existantes. Vérifier avant/après IDs, hashes, chunks, révision d’embedding et nombre de points Qdrant. Pas de DROP/TRUNCATE, pas de `down -v`, pas de réindexation destructive du corpus. Tester la migration depuis `0001`, pas seulement une base vide. Préparer une sauvegarde locale cohérente avant application à l’instance existante.

Les limites par intégration/sujet et les révocations doivent fonctionner entre workers, pas dépendre uniquement du dictionnaire mémoire actuel. Un mécanisme SQL transactionnel borné peut réutiliser PostgreSQL pour cette première version ; aucune nouvelle infrastructure n’est nécessaire sans besoin mesuré.

## Interface administrateur et widget

Conserver le shell et le design IAWEB, ajouter Login, renommer Research en AI Playground, ajouter Integrations et une documentation de mise en place. Le réglage fournisseur se limite à une liste autorisée par le serveur ; aucun champ permettant d’afficher les secrets ou de choisir une URL arbitraire de génération. Les réglages serveur bornent les réglages par requête. Analytics distingue les appels Playground/API/widget et les recherches sans résultats.

Créer un widget autonome, avec son bundle et une page iframe dédiés, partageant les composants visuels de chat mais pas le shell admin. Le loader public n’accepte que configuration publique et acquisition d’un jeton court via le portail. Nom, couleurs et logo sont validés ; pas de HTML arbitraire ni de secret permanent dans le bundle, URL, storage navigateur ou exemple.

Flux : employé connecté → backend du portail → échange de clé serveur KnowledgeOS → jeton court → widget → API v1. Le token reste en mémoire. Une expiration déclenche un renouvellement via le portail ou une reconnexion explicite. Si postMessage est utilisé pour transmettre le jeton à l’iframe, vérifier origine, source et handshake, sans wildcard de destination. La configuration iframe/CSP `frame-ancestors` et les origines CORS sont bornées par l’intégration ; CORS ne remplace pas l’autorisation.

Fournir un portail React fictif avec backend exemple et un exemple HTML/JavaScript. L’exemple d’authentification synthétique doit être explicitement distingué du SSO de production. Le secret du portail reste uniquement dans son processus serveur. Les employés ne reçoivent pas le bundle de navigation admin pour pouvoir simplement le masquer visuellement.

## Gemini : intégration et arrêt explicite

Google documente le modèle stable `gemini-3.5-flash-lite`, avec sorties structurées : https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite

Réutiliser le prompt et la validation des citations de `generation.py`, en extrayant un adaptateur Gemini backend et une validation commune. HTTPX permet une intégration REST officielle sans imposer une nouvelle couche d’orchestration. Prévoir timeout, réponse bloquée/absence de candidat, JSON invalide, citations invalides, 429 et erreurs réseau. Aucun outil de recherche web Google n’est activé pour compléter les politiques internes.

Les 429 conserveront une erreur sûre et l’information de reprise exploitable ; pas de boucle de retries illimitée ni de changement silencieux vers un fournisseur payant. Conserver `none`, OpenAI et Ollama selon la liste de fournisseurs autorisés côté serveur. Les mocks Gemini servent aux tests, jamais de preuve d’accès réel.

Variables envisagées : `LLM_PROVIDER=gemini`, `LLM_MODEL=gemini-3.5-flash-lite`, `GEMINI_API_KEY`. La valeur réelle de clé ne figure jamais dans `.env.example` ni dans l’UI. Le fichier local `.env` sera préservé et modifié uniquement sans imprimer son contenu.

**Arrêt requis par le propriétaire à l’étape de configuration Gemini :** lui demander de préparer sa clé dans son `.env` ignoré ou un secret serveur, sans la coller dans la conversation. Attendre son signal avant de vérifier l’accès réel au modèle. Ne pas activer le fournisseur ni lancer de génération auparavant.

Une requête réussie permet de vérifier l’accès à ce moment, pas de déduire tous les quotas restants ni de garantir la gratuité. Les limites actives du projet se consultent dans AI Studio. Vérifier l’offre et l’accès avec le propriétaire ; si le modèle n’est pas disponible gratuitement pour lui, exposer le résultat et proposer un autre modèle sans substitution automatique.

Références officielles : https://ai.google.dev/gemini-api/docs/rate-limits et https://ai.google.dev/gemini-api/docs/api-key

Le retrieval restera anglais avec MiniLM actuel. Générer en français avec Gemini ne corrige pas une recherche française qui ne retrouve pas les documents.

## Ordre d’implémentation et preuves attendues

1. Figer les invariants de conservation et ajouter les migrations d’identité/configuration. Tests migration et préservation.
2. Implémenter login/session/CSRF, bootstrap admin et protection de toutes les routes historiques ; adapter le frontend et ses fixtures.
3. Ajouter intégrations, périmètres, propriétaires de conversation, API v1 et limitations. Tester les accès directs, les révocations et les références d’une autre identité.
4. Implémenter widget autonome et portail synthétique en retrieval-only ; prouver les citations réelles et l’absence de secret dans les bundles.
5. Ajouter l’adaptateur Gemini et ses tests HTTP simulés, puis s’arrêter pour la clé avant toute configuration/validation réelle. Vérifier accès, coût/quota et un petit nombre de générations après le signal utilisateur.
6. Réaliser l’acceptance navigateur et API complète, les cas sans réponse, les timeouts, 429 et pannes de dépendances. Vérifier persistance et intégrité du corpus avant/après.
7. Mettre à jour README, architecture, sécurité, OpenAPI, exemples d’intégration et guide d’entretien français. Rapporter séparément résultats locaux, mocks, appels Gemini réels et limites restantes. Aucun push sans nouvelle autorisation explicite.

Tests de sécurité indispensables : un cookie admin ne se transforme pas en jeton employé ; une clé v1 n’accède pas aux documents/admin ; un token employé ne lit pas la conversation d’un autre sujet ; expiration/révocation appliquées immédiatement ; un document interdit n’apparaît ni dans le prompt ni les sources ni les historiques ; champs d’identité manipulés refusés ; aucune secret en HTML, logs, réponses et artefacts frontend ; restrictions CORS/CSRF et absence de fuite via erreurs/analytics.

## État de cette étape

Inspection de code, tests existants, Compose et note locale réalisée ; valeurs courantes lues par GET sans créer de conversation ou requête analytique. Ce plan est le seul ajout de cette étape. Pas de migration appliquée, de génération Gemini, de modification d’identité Git ou de push. Les fonctions Enterprise restent à implémenter.


## Mise à jour après implémentation — 2026-11-02

Le paragraphe précédent décrit uniquement l'inspection initiale. Les migrations 0002/0003, l'authentification admin, les intégrations, les scopes documentaires, l'isolation des employés, le widget autonome, le portail Atlas et l'adaptateur Gemini sont maintenant implémentés et vérifiés localement. Une véritable génération Gemini et les parcours navigateur ont été exécutés. Consulte `FINAL_DELIVERY_FR.md` et le dernier complément de `TESTING.md` pour l'état réellement livré, les limites et la préservation des données. Aucun push n'a été effectué.
