# KnowledgeOS Enterprise — explication pour l’entretien

> Ce projet est une reconstruction de portfolio indépendante. Les politiques et identités de démonstration sont synthétiques. Le branding IAWEB.DEV ne signifie ni application officielle, ni déploiement client réel. Les fonctionnalités décrites ci-dessous correspondent au code ; les résultats de tests exécutés doivent être lus dans `TESTING.md` et le rapport final. L’accès au modèle `gemini-3.5-flash-lite` et une génération réellement fondée sur les passages ont été vérifiés le 2026-11-02. Cela ne permet pas de connaître le quota restant ou le niveau de facturation du projet. Les tests unitaires simulés restent distincts de cette preuve réelle.

## Pitch de 30 secondes

« KnowledgeOS transforme des documents d’entreprise en une source de réponses consultable depuis un intranet. L’administrateur gère le corpus, les permissions et les intégrations dans une console protégée. L’employé utilise un widget autonome ou le chatbot développé par son entreprise. Le backend authentifie l’intégration, identifie l’employé attesté par le portail, recherche uniquement les passages autorisés dans Qdrant et peut les transmettre à Gemini pour produire une réponse avec citations. Sans modèle configuré, la démo reste fonctionnelle en affichant honnêtement les extraits retrouvés. »

## Explication de deux minutes

« Le problème métier est la dispersion de la connaissance : les salariés perdent du temps à retrouver une politique RH, une procédure IT ou une règle de projet. Un chatbot générique ne possède pas automatiquement cette connaissance et risque d’inventer une réponse. KnowledgeOS utilise donc une architecture RAG : il retrouve d’abord des passages dans les documents fournis, puis construit une réponse à partir de ces éléments.

J’ai séparé deux expériences. La console administrateur gère les documents, l’indexation, les tests dans AI Playground, les statistiques et les intégrations. Les employés ne reçoivent pas cette console : leur intranet utilise une API v1 ou un widget indépendant. Une clé d’intégration permanente reste dans le backend du portail. Celui-ci authentifie l’employé avec son propre mécanisme et peut obtenir un jeton court, lié à cet employé et à l’origine du portail.

Les permissions ne se limitent pas à masquer des boutons. Un document doit être publié pour les employés, explicitement sélectionné pour l’intégration et correctement indexé. PostgreSQL résout cette intersection ; Qdrant applique le filtre pendant la recherche. Le backend revérifie les résultats et reconstruit leurs passages depuis SQL avant de les donner au modèle.

PostgreSQL garde les métadonnées, identités, permissions et conversations. Qdrant garde les vecteurs. Les embeddings MiniLM sont calculés localement. L’adaptateur Gemini est disponible pour la génération, avec erreurs, délais et citations contrôlées, mais je distingue ses tests simulés d’un accès réel au fournisseur. La démo actuelle conserve aussi le mode retrieval-only. Cette première architecture est mono-entreprise, avec plusieurs intégrations internes ; je ne prétends pas avoir livré un SaaS multi-tenant certifié. »

## Explication technique détaillée

### 1. Deux surfaces et deux frontières de confiance

L’administrateur se connecte à KnowledgeOS avec un mot de passe Argon2id et une session serveur. Le cookie est HttpOnly ; les écritures nécessitent une origine autorisée et un jeton CSRF. Les routes admin sont protégées dans FastAPI, indépendamment du rendu React.

L’entreprise intégratrice possède un secret serveur révocable. Elle ne doit jamais l’envoyer dans son JavaScript. Son backend résout l’identité de l’employé depuis sa session/SSO. Pour un appel serveur direct, il fournit la clé et `X-Employee-Subject`. Pour le widget, il appelle `/api/v1/widget-sessions` avec le sujet résolu et l’origine exacte du portail.

Le sujet est donc **attesté par un backend de confiance**, pas prouvé indépendamment par KnowledgeOS auprès de l’IdP. Un portail compromis ou une clé volée peut usurper les sujets de son intégration. Cette limite doit être dite clairement ; on la réduit par la gestion des secrets, le périmètre documentaire, l’expiration et la révocation.

### 2. Authentifier n’est pas autoriser

Une clé valide ne donne pas tous les documents. La liste autorisée d’une intégration, le drapeau `employee_available` et le statut `indexed` doivent tous correspondre. Une liste vide refuse l’accès. Les documents historiques restent admin-only après migration.

L’employé ne choisit pas librement les IDs de documents ou le propriétaire de conversation dans une requête. Les conversations sont rattachées à une intégration et à un employé SQL, dont le sujet est unique dans cette intégration. Une conversation devinée hors de ce couple répond comme une ressource indisponible.

### 3. Chemin d’ingestion

Le système reçoit un PDF, TXT ou Markdown. Il vérifie taille, type, signature et nom, extrait le texte, conserve les pages et positions, puis produit des chunks avec recouvrement. Le découpage actuel est en caractères, pas en tokens : 900 caractères avec 150 de recouvrement par défaut.

MiniLM via FastEmbed/ONNX encode ces chunks localement en 384 dimensions. Les vecteurs et payloads vont dans Qdrant ; les textes, métadonnées et correspondances de chunks restent dans PostgreSQL. Les doublons sont détectés par hash de contenu. Les migrations SQL et le contrôle de révision d’embedding évitent de changer silencieusement la compatibilité de l’index.

### 4. Chemin d’une question employé

1. Résoudre le principal : intégration, clé active, employé et canal API/widget.
2. Vérifier expiration, révocation, origine pour le token navigateur et limites de débit.
3. Vérifier la propriété de la conversation et la disponibilité de ses sources historiques.
4. Résoudre en SQL les documents autorisés et indexés.
5. Encoder la question et effectuer le top-k Qdrant avec filtre documentaire.
6. Revérifier les IDs/rattachements en SQL et reconstruire les passages autorisés.
7. Sans passage, s’abstenir. Sans fournisseur génératif, afficher les extraits cités.
8. Avec fournisseur, construire un contexte borné, traiter les documents comme données non fiables et demander une réponse structurée avec citations.
9. Contrôler les références, puis revérifier les permissions après génération avant de retourner le résultat.
10. Persister les messages et l’événement d’utilisation, avec des données analytiques employé expurgées.

Un filtrage uniquement après top-k serait insuffisant : les meilleurs résultats interdits pourraient écarter les bons résultats autorisés. Le filtre est donc appliqué dans la recherche et revérifié ensuite.

### 5. Citations et hallucinations

Chaque source porte un document, un chunk, le texte, les offsets, une page éventuelle et un score. Gemini reçoit seulement les passages retenus. Le prompt interdit de suivre les instructions contenues dans les documents et demande de signaler le manque de preuves.

La validation vérifie notamment que les indices de citation existent et correspondent aux références annoncées. Elle ne prouve pas l’implication logique de chaque phrase. Une citation syntaxiquement valide peut encore être mal interprétée. La qualité doit donc être évaluée sur des questions et sources attendues, et non annoncée comme garantie absolue.

Le score cosinus mesure la proximité vectorielle. Ce n’est pas « 82 % de certitude ». Les questions proches du thème mais absentes du corpus restent un cas difficile : retrouver la politique de congés ne permet pas d’inventer un nombre annuel de congés acquis.

### 6. Historique et révocation

Le contrôle d’accès s’applique aussi aux anciennes sources. Si un document est retiré du périmètre, une conversation qui conserve une source interdite devient indisponible en lecture et pour les messages suivants ; elle est retirée de la liste accessible. Le propriétaire peut toujours la supprimer. Cela évite d’utiliser les snapshots historiques comme contournement de permission.

Le système ne peut pas retirer de la mémoire ou d’une capture une information déjà transmise à un navigateur. De même, un jeton bearer volé n’est pas « impossible à rejouer » : il reste exploitable pendant sa durée et ses permissions, sauf révocation de son parent. L’expiration courte et la révocation réduisent cette fenêtre.

### 7. Widget et intranet fictif

Le widget est un module ES autonome, avec Shadow DOM, sans bundle admin. Il offre ouverture/fermeture, questions, historique, sources, états de chargement et erreurs. Il utilise le même backend v1 que l’intégration serveur. Il conserve le jeton court en mémoire et ses appels KnowledgeOS utilisent `credentials: omit` pour ne pas envoyer un cookie admin.

Le portail Atlas est explicitement fictif. Son sélecteur de Camille Demo/Samir Demo sert à montrer les identités isolées ; ce n’est pas un SSO de production. Son serveur utilise un cookie de session et une protection CSRF, résout un sujet fixe côté serveur, puis échange la clé d’intégration contre un token court. La clé permanente reste dans l’environnement du serveur.

Localement, la console est sur `localhost:8080` et le portail sur `127.0.0.1:8090`. Ce choix est intentionnel : les cookies sont isolés par hôte, pas par port. En production, il faut des hôtes admin/intranet distincts, HTTPS et des cookies sans attribut Domain, sans utiliser les ports comme mécanisme d’isolation.

### 8. Docker et migrations

Compose orchestre les services nécessaires : frontend admin/Nginx, FastAPI, PostgreSQL, Qdrant et le portail de démonstration lorsqu’il est démarré. Les volumes conservent les données et le modèle. Un conteneur qui démarre ne suffit pas à prouver le bon fonctionnement ; on vérifie les endpoints, la migration et les parcours réels.

La migration `0003_enterprise_integrations` ajoute permissions, clés, employés, sessions widget, settings et audit, ainsi que les champs de propriété. Elle préserve les IDs existants. Le filtre Qdrant utilise déjà `document_id` ; ce changement n’exige pas de remplacer l’encodeur ou de reconstruire toutes les données vectorielles. PostgreSQL et Qdrant n’offrent toutefois pas une transaction distribuée commune : les réparations après panne restent un sujet opérationnel.

### 9. Gemini : expliquer honnêtement l’état

Le code Gemini appelle le backend REST officiel avec la clé en header, un modèle configurable, une limite de temps, des tentatives bornées et des réponses structurées. Les 429 et indisponibilités sont traités sans boucle infinie. Les métadonnées de tokens et de latence peuvent être conservées lorsqu’elles sont réellement retournées.

**À la rédaction de ce guide, les cas Gemini sont vérifiés avec des réponses HTTP simulées uniquement. L’appel réel attend la configuration locale de la clé du propriétaire.** Ne pas annoncer accès gratuit, quota précis, disponibilité du modèle ou réponse réelle sans la preuve correspondante. Une clé ne doit jamais être collée dans un chat, log, capture ou dépôt.

Le modèle préféré est `gemini-3.5-flash-lite`, mais la préférence de configuration n’est pas la preuve de son accessibilité pour un compte. Si l’accès ou le quota bloque, il faut le montrer et proposer une alternative avant de changer le modèle choisi.

## Questions d’entretien et réponses possibles

**1. Pourquoi du RAG plutôt qu’un chatbot généraliste ?**

Pour rechercher des informations dans un corpus contrôlé, conserver les références et limiter la réponse aux documents autorisés. Cela ne remplace pas une évaluation de qualité.

**2. Pourquoi séparer console et assistant employé ?**

Les opérations et permissions diffèrent : l’admin gère le corpus et les secrets ; l’employé ne consulte que les informations permises depuis son propre portail.

**3. Une route React protégée suffit-elle ?**

Non. Le contrôle existe aussi dans FastAPI. Un appel direct à une route admin sans session est refusé.

**4. Où est la clé d’intégration ?**

Dans le backend du portail, sous configuration secrète. KnowledgeOS n’en conserve que le hash, le préfixe et les métadonnées. Le navigateur reçoit seulement un token court.

**5. Qui prouve l’identité de l’employé ?**

Le portail de confiance via sa session ou son SSO. KnowledgeOS vérifie le credential du portail et lie le sujet attesté à cette intégration. Il ne prétend pas vérifier lui-même un IdP absent de l’architecture.

**6. Pourquoi un hash de clé plutôt qu’Argon2 pour ces clés ?**

Les clés sont aléatoires avec une forte entropie, contrairement à un mot de passe humain. Un hash SHA-256 permet la recherche sans stocker une valeur récupérable. Les mots de passe admin utilisent Argon2id.

**7. Que fait la rotation ?**

Elle révoque l’ancien credential et crée un nouveau secret affiché une seule fois, dans la même transaction. Les sessions courtes liées à l’ancien credential échouent aux prochains contrôles.

**8. Que signifie default-deny ?**

Aucun accès sans publication et sélection explicites. Une liste documentaire vide ne signifie jamais « tous les documents ».

**9. Pourquoi filtrer dans Qdrant et aussi dans SQL ?**

Qdrant limite le top-k au périmètre autorisé ; SQL vérifie ensuite les métadonnées actuelles et reconstruit les textes. Les deux contrôles ont des rôles complémentaires.

**10. Qu’arrive-t-il à un ancien document après migration ?**

Il reste conservé mais admin-only. Il faut le publier et le sélectionner pour une intégration avant de l’exposer à un employé.

**11. Comment empêcher la lecture d’une conversation devinée ?**

Le backend vérifie le couple intégration/employé, pas seulement l’existence de l’UUID. Une autre identité obtient une ressource indisponible.

**12. Une révocation peut-elle être contournée par l’historique ?**

Le backend recontrôle les documents utilisés dans les anciens messages ; les conversations contenant une source devenue interdite sont bloquées. Le texte déjà reçu par un client ne peut pas être rappelé.

**13. Pourquoi PostgreSQL et Qdrant ?**

PostgreSQL gère relations, contraintes, identités et autorisations transactionnelles. Qdrant réalise la recherche vectorielle par similarité avec filtres. Les embeddings restent dans Qdrant.

**14. Comment fonctionne un embedding ?**

Il transforme un texte en vecteur numérique. Des textes sémantiquement proches tendent à avoir des vecteurs proches selon le modèle ; cela n’établit pas leur vérité.

**15. Pourquoi le recouvrement des chunks ?**

Pour réduire la perte de contexte aux frontières. Le projet garde les offsets et pages afin de relier l’extrait à son texte d’origine.

**16. Gemini suffit-il pour rendre la recherche française fiable ?**

Non. Le corpus et l’encodeur de recherche actuels fonctionnent surtout en anglais. La génération multilingue et la recherche cross-lingue sont des problèmes distincts.

**17. Comment passer au multilingue ?**

Évaluer un encodeur adapté, vérifier ses dimensions et son identité, créer une collection compatible et réindexer de manière contrôlée, puis comparer un jeu FR/EN. Pas de changement silencieux d’environnement.

**18. Les citations garantissent-elles la justesse ?**

Non. Elles rendent la réponse inspectable et les références contrôlables. Il faut encore vérifier que le passage soutient réellement l’affirmation.

**19. Comment traiter une instruction malveillante dans un document ?**

Le prompt la traite comme une donnée non fiable, pas comme un ordre. Le contexte et les accès sont bornés. Cela réduit le risque sans promettre une protection parfaite contre toute injection.

**20. Et si Gemini est indisponible ou limité ?**

Retourner une erreur sûre, borner les délais et tentatives, respecter la reprise applicable. Ne pas simuler une réponse ni changer silencieusement de modèle payant. Le mode sans fournisseur reste disponible explicitement.

**21. Comment expliquer les coûts ?**

À partir de l’usage réel, du modèle et de ses tarifs/quotas vérifiés au moment de la démonstration. Les tokens retournés peuvent aider ; le dépôt n’invente pas un montant d’économies.

**22. Quels éléments analytiques sont privés ?**

Les événements employés ont leur question expurgée dans les analyses ; les conversations contiennent toujours leur texte sous leur propre autorisation. Cela n’équivaut pas à une politique de rétention complète.

**23. CORS est-il une authentification ?**

Non. Il borne ce que le navigateur peut lire depuis certaines origines. Les clés, sessions, propriétaires et périmètres sont contrôlés séparément côté serveur.

**24. Des ports différents isolent-ils les cookies ?**

Non. Il faut des hôtes distincts et des cookies host-only. Le local utilise localhost pour l’admin et 127.0.0.1 pour le portail ; le widget évite aussi l’envoi de cookies vers v1.

**25. Le token court est-il impossible à rejouer ?**

Non, c’est un bearer. Sa courte durée, son origine liée et la révocation de son credential parent limitent l’exposition. Une application compromise dans le même contexte reste une menace.

**26. Le portail Atlas est-il un vrai SSO ?**

Non. C’est une démonstration synthétique clairement annoncée, avec des sujets fixes. L’intégrateur de production remplace cette étape par son identité authentifiée.

**27. Est-ce multi-tenant ?**

Non. C’est une entreprise par instance avec plusieurs intégrations. L’isolation de clients/entreprises multiples demanderait un tenant authentifié dans tous les modèles, requêtes et filtres, avec des tests adversariaux dédiés.

**28. Quels tests sont réellement prouvés ?**

Consulter le rapport daté. Les tests unitaires de Gemini simulent le HTTP et ne prouvent pas l’accès du compte. Les parcours de déploiement, les requêtes RAG réelles et l’éventuel appel Gemini doivent être rapportés séparément.

**29. Quelles améliorations de production restent nécessaires ?**

SSO réel, politiques de rétention, sauvegardes/restauration éprouvées, gestion opérationnelle des secrets, observabilité, durcissement réseau, traitements d’ingestion durables et évaluation représentative. La liste exacte dépend du déploiement envisagé.

**30. Quel lien avec le stage et IAWEB.DEV ?**

Le contexte métier s’inspire d’une expérience de stage ; l’implémentation présentée est une reconstruction indépendante de portfolio. Les documents, résultats de démo et identités sont fictifs. Je ne la présente pas comme une réalisation client déployée chez IAWEB.DEV.

## Parcours de démonstration à annoncer selon les preuves disponibles

1. Connexion admin sur `http://localhost:8080/login` ; montrer l’API protégée et le corpus.
2. Knowledge Base : inspecter un document réel, ses chunks et son statut.
3. Integrations : publier le document pour les employés, créer une intégration et lui sélectionner ce document, configurer `http://127.0.0.1:8090`, puis montrer la gestion des credentials sans afficher un secret dans une capture.
4. Ouvrir le portail Atlas sur `http://127.0.0.1:8090`. Expliquer le caractère synthétique de la persona et la clé conservée côté serveur.
5. Poser une question anglaise telle que `What is the remote work policy?`. Montrer le mode réellement actif et ouvrir les sources.
6. Avec `none`, expliquer que ce sont des passages cités. Avec Gemini, annoncer une génération réelle uniquement après configuration et preuve d’une véritable requête.
7. Comparer l’historique d’une autre persona et illustrer une restriction documentaire sans exposer des informations réelles.
8. Revenir à l’activité admin : volumes, modes, latence et questions expurgées.
9. Conclure sur les limites observées : français, proximité sans preuve, quotas fournisseurs et durcissement de production.

Ne pas annoncer qu’un parcours complet a passé simplement parce que ce script existe. S’appuyer sur le dernier rapport de vérification de l’instance réellement utilisée.
