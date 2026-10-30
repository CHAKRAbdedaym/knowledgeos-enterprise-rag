# Guide d’entretien — KnowledgeOS

Ce guide présente une reconstruction personnelle de portfolio inspirée d’un contexte de stage. Ce dépôt ne constitue pas un système réellement livré à IAWEB.DEV. Les vingt documents métier, les politiques, les montants et l’organisation sont **SYNTHETIC**, entièrement inventés. Ne pas attribuer à une entreprise réelle les fonctions, résultats, utilisateurs ou décisions de cette démonstration. Les résultats mesurés se consultent dans TESTING.md et, après exécution, dans `data/evaluation-results.json`.

## Présentations orales

### Trente secondes

« KnowledgeOS est un espace de recherche documentaire avec preuves visibles. J’ai reconstruit un scénario d’agence à partir de données entièrement synthétiques : on importe un fichier, le serveur extrait et découpe son texte, calcule ses embeddings et retrouve les passages proches d’une question. L’interface permet d’inspecter le passage et sa provenance. Sans fournisseur de génération, elle présente honnêtement des extraits. Le projet démontre un flux complet et ses limites; je ne le présente pas comme une plateforme d’entreprise déjà déployée. »

### Deux minutes

« Le problème est la difficulté à retrouver une règle dans des documents dispersés. KnowledgeOS centralise les fichiers, leurs métadonnées et une recherche sémantique inspectable. Les données sont inventées et marquées comme telles. Le corpus est en anglais, cohérent avec l’encodeur local choisi; cet entretien est en français.

Le frontend React et TypeScript gère les documents, les conversations et les sources. FastAPI valide les entrées et orchestre l’ingestion. PostgreSQL conserve les métadonnées, l’historique et les traces. Qdrant conserve les vecteurs; FastEmbed calcule localement des embeddings MiniLM et LangChain assure l’intégration du vector store. Les fichiers originaux restent dans le stockage local.

Quand une question arrive, elle est encodée et comparée aux passages. Le serveur applique un top-k et un seuil. Sans modèle génératif configuré, il affiche le mode recherche et les sources; il ne simule pas une synthèse. Avec un fournisseur explicitement configuré, le prompt demande une réponse limitée aux preuves et un format de citations vérifiable.

La partie intéressante est la traçabilité : extrait exact, identifiant de passage, offsets, score de similarité et durée mesurée. L’évaluation distingue rappel documentaire et exactitude d’une réponse. Les limites sont assumées : pas de SSO, de multi-tenant ni de garantie contre les hallucinations. Mon prochain travail de production serait de sécuriser les accès avant d’élargir le corpus et les usages. »

### Cinq minutes

« Je pars d’un problème concret : savoir où se trouve une règle et pourquoi une réponse semble crédible. Une boîte de conversation sans accès aux preuves ne résout pas ce problème. J’ai donc construit un espace où l’on peut passer du fichier à ses passages, puis d’une question aux sources utilisées.

Le périmètre est volontairement précis : une démonstration locale et mono-utilisateur, sur un corpus fictif d’agence. Vingt documents couvrent l’intégration, les congés, les incidents, les SLA, le développement et la gouvernance. Chaque document indique sa provenance synthétique. Aucun document interne réel, nom de salarié ou résultat commercial réel n’est exposé. Cette distinction est une partie du travail, pas une note ajoutée après coup.

À l’import, le backend vérifie format et taille, extrait le texte et conserve l’original. Il découpe le contenu en passages avec recouvrement, garde leurs positions et calcule leurs vecteurs. Le modèle local MiniLM produit 384 dimensions. PostgreSQL conserve le cycle de vie du document et Qdrant l’index de recherche. Le modèle et sa révision font partie de la traçabilité; changer d’encodeur implique une migration de l’index.

À la recherche, la question suit le même encodeur. La comparaison cosinus retourne des passages classés; le top-k limite la quantité et le seuil filtre les correspondances faibles. Ces paramètres font un compromis entre couverture et bruit. Le score n’est pas une probabilité de vérité. Une question sans réponse peut encore avoir des voisins proches, donc un simple seuil ne constitue pas un détecteur universel d’absence de preuve.

La génération est optionnelle. Sans clé ni serveur de modèle, la démonstration reste utile : elle retourne réellement des extraits avec sources et signale l’absence de synthèse. Avec un fournisseur configuré, un prompt sépare les règles de l’application des documents non fiables. Le serveur vérifie le format et les références de citations retournées. Cela bloque certaines réponses malformées mais ne prouve pas que chaque affirmation est impliquée par son passage. La vérification humaine reste nécessaire.

Dans l’interface, je montre une question sur le télétravail, j’ouvre le passage, puis le document original. Je montre aussi les traces et un cas hors périmètre. Les statistiques proviennent des enregistrements du serveur; elles ne démontrent pas une adoption réelle. Le script d’évaluation compare les sources récupérées aux documents attendus et calcule uniquement des mesures observées. Les tests déterministes isolent le pipeline et les erreurs; ils ne remplacent pas un essai avec le modèle réel ou un fournisseur distant.

Les compromis sont la simplicité d’exploitation et l’inspectabilité. Une ingestion synchrone est raisonnable pour ce petit corpus mais pas pour une file de milliers de documents. Le stockage local simplifie la démo mais demanderait sauvegardes, contrôle d’accès et exploitation en production. Pour aller plus loin, je prioriserais l’authentification et le filtrage par droits, une ingestion asynchrone idempotente, puis une recherche hybride et un reranking évalués. Je peux expliquer le fonctionnement actuel sans revendiquer les fonctions futures. »

## Questions et réponses

1. **Quel problème métier résolvez-vous ?** Retrouver une information et son contexte dans une documentation dispersée. La valeur démontrée est le chemin vérifiable entre question et passage; aucune économie financière réelle n’est revendiquée.

2. **Est-ce votre projet de stage livré au client ?** C’est une reconstruction de portfolio. Je distingue l’inspiration du stage, le code présent dans ce dépôt et les résultats effectivement vérifiés. Je n’attribue pas cette application à un client réel.

3. **Les documents sont-ils authentiques ?** Non. Ils sont synthétiques, avec des règles inventées et une mention explicite dans chaque fichier. Le manifeste décrit titres, catégories et tags. Les données ne prouvent rien sur l’entreprise citée.

4. **Pourquoi le corpus est-il en anglais ?** Le modèle par défaut est `sentence-transformers/all-MiniLM-L6-v2`, principalement adapté à l’anglais. Le corpus et les questions d’évaluation suivent ce choix. Je ne revendique pas un bon rappel multilingue sans mesure.

5. **Pourquoi FastAPI ?** Il permet une frontière HTTP typée et une validation explicite via Pydantic. Il convient à un pipeline Python et expose un contrat inspectable. Ce choix ne rend pas les traitements lourds automatiquement non bloquants.

6. **Pourquoi PostgreSQL ?** Les documents, conversations, messages et traces ont des relations et des contraintes transactionnelles. PostgreSQL facilite migrations et cohérence de ces métadonnées. Le contenu vectoriel conserve une responsabilité distincte.

7. **Pourquoi Qdrant ?** Il fournit une recherche vectorielle persistante et un filtrage par métadonnées. Je peux y supprimer les points liés à un document et inspecter la configuration. Pour un très petit corpus, un stockage plus simple resterait une alternative défendable.

8. **Pourquoi pas uniquement pgvector ?** Réunir métadonnées et vecteurs dans PostgreSQL réduirait le nombre de services. Ici, Qdrant rend explicite l’apprentissage du vector store. Ce n’est pas une affirmation que deux bases sont toujours préférables.

9. **Que fait réellement LangChain ?** Son intégration Qdrant est utilisée pour le vector store et la recherche. Elle ne remplace ni FastAPI, ni la base relationnelle, ni toute la logique d’ingestion. Je peux pointer son usage concret dans le code.

10. **Pourquoi FastEmbed ?** Il exécute localement un modèle ONNX sur CPU, sans imposer une pile GPU complète. Le premier téléchargement du modèle reste une dépendance réseau et sa mise en cache doit être prise en compte dans l’installation.

11. **Quelle dimension ont les embeddings ?** 384 pour le modèle actuel. Cette dimension est liée à la collection. Il serait incorrect de changer seulement le nom du modèle puis de réutiliser les anciens vecteurs.

12. **Qu’est-ce qu’un embedding ?** Une représentation numérique d’un texte permettant de comparer des proximités apprises. Ce n’est pas une base de faits exacte ni un chiffrement réversible conçu pour protéger les données.

13. **Que signifie similarité cosinus ?** Elle compare l’orientation de deux vecteurs via leur produit scalaire normalisé. Une proximité élevée suggère une relation sémantique; elle ne garantit ni une réponse présente ni une politique encore valide.

14. **Pourquoi découper les documents ?** Un document entier mélange souvent plusieurs sujets et produit un contexte trop large. Des passages plus courts améliorent la localisation et la citation. Ils peuvent aussi séparer une règle de son exception, d’où la nécessité d’évaluer le découpage.

15. **Quel découpage utilisez-vous ?** Par défaut, des passages de 900 caractères avec 150 caractères de recouvrement. Il s’agit de caractères, pas de tokens. Les valeurs de l’environnement actif se consultent dans Settings.

16. **Pourquoi un recouvrement ?** Il conserve une partie du contexte aux frontières. Trop faible, il coupe les relations utiles; trop fort, il augmente stockage, coût et redondance dans les résultats. Il faut mesurer son effet plutôt que le considérer comme une constante optimale.

17. **Comment retrouver l’origine d’un passage ?** Une source contient identifiant du document, identifiant du chunk, texte, offsets de début et fin, score et page lorsqu’elle existe. Un Markdown n’a pas nécessairement de pagination; l’interface ne doit pas inventer une page.

18. **Que devient un PDF scanné ?** L’extraction textuelle ne constitue pas un OCR. Un PDF image peut ne produire aucun texte exploitable et doit être rejeté ou traité séparément. Je n’annonce pas une capacité OCR absente.

19. **Comment sont traités les doublons ?** Le backend rejette un contenu déjà connu avec HTTP 409. Le script de peuplement traite ce cas comme un saut idempotent et les autres erreurs comme des échecs. Ce comportement ne doit pas masquer un document dont l’ingestion est incomplète.

20. **Que garantit la réindexation ?** Elle retraitera le fichier conservé selon la configuration actuelle. Les erreurs restent visibles et les points d’index sont remplacés selon le flux serveur. Une coordination entre deux stockages n’est pas une transaction distribuée atomique.

21. **Que se passe-t-il à la suppression ?** Le flux supprime le document et ses points vectoriels. Des citations déjà enregistrées dans un historique peuvent perdre l’accès au document original. C’est une limite explicite à tester et à expliquer.

22. **Comment une question est-elle traitée ?** Validation, embedding local de la question, recherche des passages, application du seuil et top-k, puis réponse en mode extraits ou génération configurée. Les traces donnent les paramètres et durées observés.

23. **À quoi sert top-k ?** Il borne le nombre de passages retournés. Une valeur plus grande peut améliorer la couverture mais ajouter du bruit et de la redondance. Le maximum accepté par l’API actuelle est dix.

24. **Que fait le seuil ?** Il filtre des correspondances selon leur similarité. Le défaut est 0,3. Un seuil unique n’est pas calibré comme une probabilité et peut produire de faux rapprochements sur des questions hors sujet.

25. **Sans clé de modèle, est-ce du RAG ?** Le pipeline de récupération est réel. Le mode par défaut est recherche seule, explicitement sans génération. Je parle de base d’un système RAG et d’extraits récupérés, sans présenter un texte préfabriqué comme une réponse générée.

26. **Quels générateurs sont prévus ?** Le backend propose `none`, `openai` et `ollama`. Leur disponibilité dépend de la configuration réelle du serveur. L’interface ne crée pas une clé ni un modèle installé en changeant une préférence locale.

27. **Que se passe-t-il si le fournisseur échoue ?** L’application doit rendre l’erreur visible et permettre une nouvelle tentative; elle ne fabrique pas une réponse de secours. La recherche diagnostique reste une manière distincte d’inspecter les passages, sans prétendre que la génération a réussi.

28. **Comment rédigez-vous le prompt ?** Il limite la réponse aux preuves, impose des citations numérotées et demande un format JSON avec réponse, citations et indicateur de preuve insuffisante. Documents et historique sont explicitement des données non fiables, jamais une autorité de contrôle.

29. **Ce prompt suffit-il contre les injections ?** Non. Il réduit certains comportements indésirables, mais ne constitue pas une frontière de sécurité complète. Il faut aussi droits d’accès, limitation des outils, validation et essais adversariaux. Le système actuel n’effectue pas d’actions externes depuis un document.

30. **Validez-vous les citations ?** Le serveur contrôle les références numériques, leur présence et leur appartenance aux sources récupérées. Il ne prouve pas automatiquement que le passage implique chaque phrase. Validité structurelle et fidélité sémantique restent deux niveaux différents.

31. **Comment limiter les hallucinations ?** Restreindre le contexte, demander l’abstention, vérifier les citations et exposer les sources. Ces mesures réduisent le risque sans l’annuler. La génération n’est même pas activée dans le mode local par défaut.

32. **Que faites-vous quand aucune source ne passe le seuil ?** Le serveur renvoie une indication de preuve insuffisante. Il ne complète pas à partir de connaissances générales. Attention : une question sans réponse peut malgré tout récupérer des passages proches; il faut examiner les faux positifs.

33. **Le score affiché est-il un pourcentage de certitude ?** Non. L’interface peut le formater en pourcentage de similarité, mais le panneau précise sa nature. Il ne mesure ni probabilité de vérité ni qualité de la réponse.

34. **Comment gérez-vous l’historique ?** PostgreSQL conserve les conversations et messages. Le générateur reçoit une fenêtre bornée d’historique. La récupération actuelle porte sur la question envoyée et n’implémente pas une réécriture conversationnelle sophistiquée.

35. **Pourquoi ne pas streamer ?** Le flux actuel attend une réponse complète et montre un état de chargement. Cela simplifie erreurs et validation JSON. Je ne présente pas une animation de chargement comme des tokens réellement reçus en streaming.

36. **Pourquoi une ingestion synchrone ?** Le corpus de démonstration est petit et la simplicité favorise l’inspection. Pour des fichiers importants ou de nombreux utilisateurs, une file de tâches avec reprise, états persistants et workers serait plus adaptée.

37. **Qu’évalue votre script ?** Le rappel documentaire moyen sur les questions supportées et le taux d’absence de résultats sur les questions sans réponse. Il conserve sources, scores, paramètres et traces effectivement reçus de `/api/retrieval`.

38. **Comment calculez-vous le rappel ?** Pour chaque question supportée : nombre de documents attendus récupérés divisé par nombre de documents attendus. La moyenne porte sur ces questions. Des passages supplémentaires du même fichier ne gonflent pas artificiellement ce score documentaire.

39. **Votre benchmark mesure-t-il l’exactitude des réponses ?** Non. Un document attendu présent dans le top-k ne garantit pas que le bon paragraphe est présent ni qu’une synthèse est correcte. Il faudrait annoter les passages puis évaluer fidélité, complétude et utilité des réponses séparément.

40. **Pourquoi des questions hors sujet ?** Elles exposent les rapprochements trompeurs et le besoin d’abstention. Le jeu inclut cuisine, astronomie, sport et informations d’entreprise non présentes. Une absence de source est mesurée, jamais supposée à partir du libellé.

41. **Que montrent les tests déterministes ?** Ils isolent extraction, validation, génération contrôlée et erreurs sans dépendre d’un fournisseur distant. Les embeddings de test ne remplacent pas une mesure du modèle réel. Les types de vérification doivent rester distingués dans le rapport.

42. **Comment éviter des métriques inventées ?** Les tableaux lisent des enregistrements persistés et les scripts écrivent uniquement après exécution réussie. Un résultat manquant reste non mesuré. L’activité de démo ne doit jamais être présentée comme une adoption par des utilisateurs réels.

43. **Le système est-il sécurisé pour une entreprise ?** C’est une démonstration locale sans SSO ni isolation multi-tenant. Validation, limites d’import et configuration expurgée sont utiles mais insuffisantes pour un service d’entreprise exposé.

44. **Où appliqueriez-vous les droits documentaires ?** Avant la récupération et avant toute transmission au générateur, avec des filtres issus de l’identité authentifiée côté serveur. Cacher un document dans le frontend n’empêche pas sa récupération par API.

45. **Où sont les données ?** Métadonnées et historique dans PostgreSQL, vecteurs dans Qdrant, originaux et cache de modèle dans le stockage configuré. Les volumes persistants permettent de conserver l’état après redémarrage. Persistance et sauvegarde ne sont pas synonymes.

46. **Comment passer en production ?** D’abord identité, droits, secrets, chiffrement des échanges, sauvegardes et restauration testée. Ensuite observabilité, ingestion asynchrone, limites de charge et politiques de conservation. Ces éléments sont une feuille de route et ne deviennent pas des fonctions présentes par leur mention.

47. **Comment améliorer la recherche ?** Mesurer d’abord les échecs : mauvais passage, absence de vocabulaire exact, langue, duplication. Ensuite comparer recherche hybride, reranking ou modèle multilingue sur un jeu annoté, avec latence et coûts. Aucun ajout ne vaut preuve d’amélioration sans comparaison.

48. **Quelles limites de l’évaluation reconnaissez-vous ?** Petit corpus propre, questions écrites en connaissant les documents, peu de diversité et seuil non calibré. Les doublons entre FAQ et guides peuvent affecter l’interprétation. Des questions rédigées indépendamment seraient une meilleure validation externe.

49. **Pourquoi React et TypeScript ?** Ils facilitent des composants cohérents et un contrat de données explicite côté interface. Les états vide, attente, erreur et succès font partie du produit. Le typage statique ne remplace pas la validation réseau ni les essais d’accessibilité.

50. **Qu’avez-vous appris ?** Qu’un pipeline crédible exige provenance, cohérence des états et mesures avant promesses. La difficulté n’est pas seulement d’appeler un modèle : il faut expliquer une réponse, gérer un échec et dire précisément ce qui reste non vérifié.

51. **Que montrer si le réseau tombe ?** Si le modèle local est déjà en cache et les services sont disponibles, démontrer la recherche sans fournisseur. Sinon, montrer l’erreur réelle et le code ou les preuves déjà enregistrées en précisant leur date. Ne jamais faire passer une capture antérieure pour un résultat vivant.

52. **Quel résultat pouvez-vous annoncer en entretien ?** Seulement les résultats du rapport d’exécution disponible et leur périmètre. Je peux annoncer l’existence du corpus synthétique et des scripts en lisant le dépôt. Je ne peux annoncer un pourcentage de qualité, une réduction de coût ou un test fournisseur réussi sans preuve correspondante.

## Points à vérifier avant de parler

- Lire les valeurs de Settings et la dernière exécution de TESTING.md.
- Ouvrir un fichier synthétique et expliquer sa provenance avant toute question métier.
- Distinguer une source retrouvée, une réponse générée et une affirmation vérifiée.
- Nommer les limites présentes, puis présenter les améliorations comme du travail futur.
