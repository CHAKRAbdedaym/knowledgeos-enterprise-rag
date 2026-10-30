# Démonstration KnowledgeOS — six minutes

Cette démonstration présente une reconstruction de portfolio. Toute information d’entreprise montrée est **SYNTHETIC**, inventée pour ce projet; aucun document interne réel d’IAWEB.DEV n’est utilisé. Les questions sont en anglais car le corpus et l’encodeur local par défaut sont principalement anglophones. Le commentaire oral est en français.

## Préparation, avant le chronomètre

Démarrer l’application selon le README. Ouvrir l’URL du frontend indiquée dans ce même fichier. Vérifier `/settings` : API connectée, stockage prêt et mode fournisseur connu. La readiness vérifie les services; elle ne garantit pas que le premier téléchargement d’embeddings est terminé. Exécuter un import ou une recherche avant l’entretien pour chauffer le modèle et confirmer son fonctionnement réel.

Pour le parcours sans clé, conserver `LLM_PROVIDER=none` côté serveur. Il n’est pas nécessaire d’inventer une clé ni de simuler un fournisseur. Le bandeau indique la reconstruction synthétique et le mode recherche. Le changement d’une préférence d’interface ne configure pas un fournisseur côté serveur.

Peupler les documents via `python scripts/seed.py`. Une seconde exécution doit ignorer les doublons HTTP 409; les autres erreurs restent des échecs. Pour préparer une preuve de recherche, exécuter `python scripts/evaluate.py` et lire le fichier produit. Ne pas annoncer une valeur de rappel avant d’avoir lu son résultat mesuré. Conserver uniquement des fichiers synthétiques dans l’environnement présenté.

Si la base est vide, utiliser d’abord l’interface d’import ci-dessous puis peupler le reste hors chronomètre. Si elle est déjà peuplée, inspecter un document existant : réimporter le même contenu donnera normalement un conflit de doublon. Ne pas supprimer le corpus pour obtenir un effet de première utilisation.

## 0:00–0:40 — cadrer le produit, route `/`

Montrer Overview et le bandeau de provenance.

Dire : « KnowledgeOS rassemble des documents et rend la recherche vérifiable. Ce que vous voyez est une reconstruction de portfolio sur données fictives. Les compteurs viennent de cet environnement local. Ils ne représentent pas des utilisateurs réels d’entreprise. Je vais suivre un fichier jusqu’à un passage trouvé, puis expliquer les limites de la réponse. »

Montrer le nombre de documents et l’activité réellement disponibles. Une base vide est un état normal; ne pas lire des chiffres préparés comme s’ils étaient affichés.

## 0:40–1:40 — inspecter la connaissance, route `/documents`

Cliquer Knowledge Base. Rechercher `leave` et ouvrir `05_leave_remote`. Dans **Extracted text**, montrer la mention **SYNTHETIC** et la règle des trois jours de télétravail. Dans **Indexed chunks**, montrer que le texte a été découpé. Dans **File details**, montrer le nom, les tags et les métadonnées. Fermer le panneau.

Dire : « L’import conserve un original et produit des passages traçables. La catégorie et les tags aident à organiser les fichiers. La pagination peut être absente pour du Markdown; je ne prétends pas disposer d’une page PDF quand elle n’existe pas. »

Variante si un premier import est nécessaire : **Upload document**, sélectionner `data/synthetic/05_leave_remote.md`, catégorie `people`, tags `leave,remote-work`, puis **Upload & index**. Attendre la fin réelle de l’indexation. L’envoi réseau et le traitement serveur sont deux étapes; ne pas annoncer la fin au seul passage de la barre d’envoi à 100 %. En cas de 409, expliquer le doublon et ouvrir la copie existante.

## 1:40–3:00 — poser une question et lire la preuve, route `/research`

Cliquer Research, puis **New conversation** si nécessaire. Dans **Research question**, saisir :

> How many remote-work days per week are allowed, and what are the shared collaboration hours?

Envoyer avec **Send question** ou Entrée. Attendre le résultat serveur. Sans fournisseur, montrer **Retrieved excerpts** et le texte indiquant que la génération est désactivée. Cliquer une source `05_leave_remote` ou une autre source cohérente, par exemple la FAQ, puis lire le passage exact : jusqu’à trois jours avec accord du manager; plage commune 10:00–16:00 Paris.

Dire : « Le résultat est un ensemble de passages réellement retrouvés. Dans ce mode, le serveur n’a pas demandé à un modèle de rédiger une synthèse. Le badge rend cette différence visible. Je vérifie ici la condition d’approbation et le fuseau, pas seulement le nombre de jours. »

Dans **Follow the evidence**, montrer l’identifiant de chunk, les offsets et le score. Préciser : « C’est une similarité, pas un pourcentage de certitude. » Cliquer **Open original document** pour revenir à la source, puis revenir à Research. Ouvrir **Retrieval trace** pour les paramètres et durées observées. Ne pas réciter une latence fixe.

## 3:00–3:40 — rendre la limite observable, route `/research`

Poser :

> What is the exact orbital period of Neptune?

Dire avant de lire le résultat : « Cette information n’appartient pas au corpus. Un système documentaire devrait le reconnaître. Mais un seuil de similarité peut encore retourner des voisins sans rapport : je vais examiner ce qui est réellement obtenu. »

Si aucune source ne passe le seuil, montrer **Insufficient evidence**. Si des sources apparaissent, ouvrir un passage et dire : « Voici un faux rapprochement de la récupération. Ce passage n’établit pas la réponse. Le score n’est pas un détecteur universel de question hors périmètre. » Ne pas affirmer que le refus est garanti. Le script d’évaluation conserve aussi ce type de résultat.

Option pédagogique : ouvrir **Search settings**, augmenter le seuil et relancer la même question; expliquer que l’essai change la précision et la couverture. Ne pas remplacer cette mesure par une réponse astronomique issue de connaissances générales.

## 3:40–4:15 — lire l’activité, route `/analytics`

Cliquer Intelligence. Montrer **Questions asked**, **Average response time**, **Sources per response**, la courbe et les documents référencés si des données existent. Choisir 7 ou 30 jours pour montrer une période réelle.

Dire : « Ces indicateurs proviennent des conversations enregistrées. Ils décrivent le fonctionnement de cette démonstration. Ils ne mesurent ni satisfaction client, ni qualité de chaque réponse, ni adoption réelle. Les requêtes diagnostiques et l’évaluation de récupération ne doivent pas être assimilées à des conversations utilisateur. »

Si la courbe est vide, expliquer qu’il manque des observations pour cette période. Ne pas remplir verbalement un état vide par une tendance inventée.

## 4:15–5:10 — expliquer le mécanisme, route `/architecture`

Cliquer Architecture. Suivre les cinq étapes **Ingest**, **Chunk**, **Embed & index**, **Retrieve**, **Respond**.

Dire : « FastAPI orchestre le traitement. PostgreSQL conserve les métadonnées et conversations. FastEmbed calcule les embeddings locaux de 384 dimensions; Qdrant conserve les vecteurs, avec l’intégration LangChain. Le découpage par défaut est de 900 caractères avec 150 de recouvrement. Ce sont des paramètres de départ, pas une preuve d’optimalité. Le générateur reste optionnel. »

Dans **Try the retrieval layer**, saisir :

> How long are security logs retained?

Cliquer **Run retrieval**. Inspecter les passages retournés et, si présent, `13_data_governance` qui donne 180 jours. Expliquer que ce diagnostic appelle la récupération sans génération et permet d’isoler cette partie du système. Si le document attendu n’apparaît pas, le signaler comme un échec observable plutôt que changer silencieusement de question.

## 5:10–6:00 — configuration et limites, route `/settings`

Cliquer Settings. Montrer **API health**, **Retrieval readiness**, les valeurs de l’encodeur, du découpage et du fournisseur. Rafraîchir avec **Refresh status** si nécessaire. Montrer que la configuration affichée est expurgée des secrets. Les préférences de recherche enregistrées dans le navigateur ne sont pas une configuration globale d’entreprise.

Dire : « Sans clé et sans serveur de modèle, la démonstration garde une recherche locale utile et honnête. Le backend prévoit des fournisseurs optionnels, mais un test déterministe ne prouve pas qu’un fournisseur réel a répondu. Cette version est locale et mono-utilisateur, sans SSO ni isolation entre organisations. Pour la production, je commencerais par les droits documentaires, la restauration et l’ingestion asynchrone. Le résultat démontré ici est la chaîne fichier–passage–question et sa traçabilité. »

Terminer à six minutes. Réserver les questions à l’échange suivant; ne pas ajouter une promesse de déploiement ou de conformité.

## Variante avec fournisseur réellement configuré

N’utiliser cette variante qu’après un essai réussi dans l’environnement présenté. Configurer côté serveur le fournisseur et son modèle conformément au README, puis redémarrer les services concernés. Pour un service externe, l’envoi des passages n’est autorisé que pour les données synthétiques de cette démonstration. Pour Ollama, le modèle doit être effectivement installé et le serveur joignable.

Dans Research, poser la question du télétravail, vérifier le badge **Grounded answer**, les références numérotées et les passages. Dire qu’une validation de structure des citations n’est pas une preuve automatique de fidélité sémantique. Une erreur réseau est montrée comme erreur; ne pas remplacer discrètement son résultat par un texte préparé. Le parcours sans clé reste le parcours de référence.

## Captures et preuves

Les captures suivantes ont été produites depuis l’application réellement exécutée le 30 octobre 2026, en mode retrieval-only. Elles servent de repli visuel; les compteurs reflètent les véritables requêtes de démonstration et de test.

| Vue | Capture réelle |
| --- | --- |
| Overview `/` | [Vue bureau](screenshots/overview-desktop.png) · [mobile](screenshots/overview-mobile.png) · [thème sombre](screenshots/overview-dark.png) |
| Knowledge Base `/documents` | [Documents indexés](screenshots/knowledge-base.png) |
| Research `/research` | [Extraits et citations](screenshots/research-citations.png) · [preuve exacte](screenshots/source-evidence.png) |
| Intelligence `/analytics` | [Mesures enregistrées](screenshots/analytics.png) |
| Architecture `/architecture` | [Pipeline réel](screenshots/architecture.png) |
| Settings `/settings` | [Configuration et santé](screenshots/settings.png) |

Les captures éventuelles ne remplacent pas le rapport d’exécution. Pour annoncer des résultats chiffrés, consulter la preuve datée et préciser corpus, top-k, seuil et mode fournisseur.
