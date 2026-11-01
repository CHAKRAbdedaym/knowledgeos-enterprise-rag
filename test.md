# Tests manuels RH — KnowledgeOS

> **Données entièrement fictives.** Les politiques et chiffres ci-dessous appartiennent à la démonstration ; ce ne sont pas les règles réelles de IAWEB.DEV.

## Avant de commencer

1. Ouvrir http://localhost:8080 et actualiser la page après le nettoyage de l’historique.
2. Aller dans **Research**, puis **New conversation**, ou ouvrir le chatbot en bas à droite.
3. Si le chatbot conserve une référence à une conversation supprimée, cliquer sur **+** (« Start a new quick chat »). Cela réinitialise sa référence locale.
4. Garder les réglages de recherche à **5 passages** et **0,30** de seuil pour reproduire les vérifications ci-dessous.
5. Copier un message anglais ci-dessous, envoyer, puis ouvrir les sources pour comparer le passage avec les éléments attendus.

**Langue :** les explications sont en français, mais les messages de démonstration sont en anglais. Le corpus et le modèle d’embeddings actuels ne donnent pas une recherche française fiable. Les variantes françaises testées n’ont retrouvé aucun passage au seuil 0,30 ; elles figurent plus bas comme tests de cette limite.

**Mode actuel : Retrieval only.** Sans fournisseur LLM, le front affiche des passages cités et ne rédige pas une réponse IA. Les « éléments attendus » ci-dessous sont les faits à retrouver dans les sources, pas un texte que le chatbot est censé générer. Avec un fournisseur configuré, vérifier aussi que chaque affirmation de la réponse est appuyée par ces sources.

Ne pas téléverser ce fichier dans la base documentaire : il sert de fiche de test, pas de source RH.

## Démo rapide : quatre messages

Pour une démonstration courte, utiliser **RH01 → RH10 → RH12 → ABS05** : télétravail, formation, frais, puis question hors sujet. Ouvrir au moins une citation après chaque question RH.

## Questions RH à copier

### RH01 — Télétravail

    How many remote-work days are allowed per week?

**Éléments attendus :** Jusqu’à **3 jours par semaine**, avec accord du manager.

**Source principale :** [Leave, absence and remote work](data/synthetic/05_leave_remote.md).

### RH02 — Demande de congés

    How far in advance should I request planned leave?

**Éléments attendus :** Demander les congés prévus **10 jours ouvrés avant** le départ. Une demande ne vaut pas approbation.

**Source principale :** [Leave, absence and remote work](data/synthetic/05_leave_remote.md).

### RH03 — Absence de plus de cinq jours

    How far ahead should leave longer than five working days ideally be requested?

**Éléments attendus :** Préavis conseillé de **20 jours ouvrés** pour une absence de plus de cinq jours ouvrés. Il s’agit d’un délai de demande, pas d’un nombre de jours de congés acquis.

**Source principale :** [Leave, absence and remote work](data/synthetic/05_leave_remote.md).

### RH04 — Réponse à une demande de congés

    Within how many working days does the manager respond to a leave request?

**Éléments attendus :** Le manager répond sous **3 jours ouvrés**, après vérification de la couverture. L’approbation doit être enregistrée.

**Source principale :** [Leave, absence and remote work](data/synthetic/05_leave_remote.md).

### RH05 — Absence imprévue

    Who should I notify about an unexpected absence?

**Éléments attendus :** Prévenir **le manager et Operations** dès que raisonnablement possible. Ne pas publier de renseignements médicaux dans les canaux projet.

**Source principale :** [Leave, absence and remote work](data/synthetic/05_leave_remote.md).

### RH06 — Télétravail depuis un autre pays

    Can I work remotely from another country without prior approval?

**Éléments attendus :** Accord préalable de **Operations et du manager**, avec examen distinct des questions fiscales, contractuelles et de sécurité.

**Source principale :** [Leave, absence and remote work](data/synthetic/05_leave_remote.md).

### RH07 — Horaires de collaboration

    What are the shared collaboration hours and the reference working week?

**Éléments attendus :** Semaine de référence de **35 heures** ; plage commune **10 h–16 h, heure de Paris**. Ne pas confondre cette plage de coordination avec toute la durée quotidienne de travail.

**Source principale :** [People practices and collaboration](data/synthetic/04_hr.md).

### RH08 — Suivi de l’intégration

    What are the three onboarding follow-up milestones?

**Éléments attendus :** Points de suivi aux **jours 7, 30 et 60**. Ce sont des jalons fictifs d’intégration, pas une durée légale de période d’essai.

**Source principale :** [Employee onboarding](data/synthetic/03_onboarding.md).

### RH09 — Préparation de l’arrivée

    How many working days before arrival does Operations confirm the start date, role, manager and equipment?

**Éléments attendus :** Operations confirme la **date de début, le rôle, le manager et le matériel cinq jours ouvrés avant l’arrivée**.

**Source principale :** [Employee onboarding](data/synthetic/03_onboarding.md).

### RH10 — Budget de formation

    What is the annual learning allowance and how many planned training days are provided?

**Éléments attendus :** **600 euros par personne et par an**, avec **2 jours de formation prévus**. Le budget disponible ne remplace pas l’autorisation préalable du manager.

**Source principale :** [Training and knowledge sharing](data/synthetic/15_training.md).

### RH11 — Réponse à une demande de formation

    How soon must the manager respond to a training request?

**Éléments attendus :** Le manager répond sous **5 jours ouvrés**. Ne pas confondre avec les trois jours prévus pour une demande de congés.

**Source principale :** [Training and knowledge sharing](data/synthetic/15_training.md).

### RH12 — Plafonds de déplacement

    What are the indicative hotel and meal ceilings?

**Éléments attendus :** Hôtel : **120 euros par nuit, hors petit-déjeuner**. Repas : **25 euros par repas**. Un dépassement prévisible doit être approuvé avant la réservation.

**Source principale :** [Business travel and expenses](data/synthetic/20_travel.md).

### RH13 — Note de frais

    How soon after returning from business travel should I submit my expense report?

**Éléments attendus :** Envoyer la note de frais sous **10 jours ouvrés après le retour**, avec les justificatifs. Le délai cible de traitement d’un dossier complet est distinct : 15 jours ouvrés.

**Source principale :** [Business travel and expenses](data/synthetic/20_travel.md).

### RH14 — Problème impliquant le manager

    Who can I contact if I have a workplace concern involving my manager?

**Éléments attendus :** Contacter **Operations directement**, dans un espace restreint, notamment si la difficulté concerne son propre manager.

**Source principale :** [People practices and collaboration](data/synthetic/04_hr.md).

### RH15 — Entretiens individuels

    How often are individual feedback meetings held and how long do they last?

**Éléments attendus :** Un entretien de **30 minutes toutes les deux semaines** : charge, obstacles, progression et coopération.

**Source principale :** [People practices and collaboration](data/synthetic/04_hr.md).

### RH16 — Passation avant congés

    Can I share my password with the colleague covering my leave?

**Éléments attendus :** **Ne jamais partager son mot de passe.** Les droits nécessaires au remplaçant suivent la procédure de demande d’accès IT.

**Source principale :** [Leave, absence and remote work](data/synthetic/05_leave_remote.md).

## Questions sans réponse documentée

Ces cas vérifient que l’interface ne transforme pas des passages voisins en faits inventés. Lors de la vérification du 1er novembre 2026, ABS01–ABS04 ont remonté des documents proches du sujet, mais sans les données demandées ; ABS05 n’a remonté aucun passage. Le seuil de similarité ne suffit donc pas à garantir une abstention sur toutes les questions RH non couvertes.

En mode retrieval-only, des extraits connexes ne constituent pas une réponse. Avec un LLM, le résultat attendu est une indication claire de l’information absente, sans nombre inventé.

### ABS01 — Salaire individuel

    What is the individual salary of the real company director?

**Attendu :** Aucun salaire individuel réel n’existe dans ce corpus. Ne pas produire un montant ni l’inférer du budget de formation.

### ABS02 — Droits annuels à congés

    How many days of annual paid leave am I entitled to?

**Attendu :** Le nombre de jours de congés annuels n’est pas défini. Les nombres 10 et 20 du guide correspondent à des délais de demande.

### ABS03 — Congé de paternité

    How many days of paid paternity leave are provided?

**Attendu :** La durée du congé de paternité n’est pas définie. Ne pas importer une règle légale extérieure au corpus.

### ABS04 — Indemnité kilométrique

    What is the mileage reimbursement rate per kilometer?

**Attendu :** Aucun barème kilométrique n’est fourni. Le plafond hôtel/repas ne permet pas d’en déduire un tarif.

### ABS05 — Hors sujet : abstention visible

    How do I bake a sourdough loaf with rye flour?

**Attendu :** Attendre un état **Insufficient evidence**, sans recette ni citation inventée. Ce message ne concerne pas la base RH.

## Tests en français : limite actuelle à observer

Essayer les trois formulations suivantes pour constater la limite linguistique actuelle, puis comparer avec RH01, RH10 et RH05 en anglais. Elles ne doivent pas servir de démonstration de recherche française réussie.

    Combien de jours de télétravail sont autorisés par semaine ?

    Quel est le budget annuel de formation et combien de jours sont prévus ?

    Qui dois-je prévenir en cas d’absence imprévue ?

Au seuil vérifié, aucun passage n’a été retrouvé pour ces formulations françaises. Attendre l’état de manque de contexte, plutôt qu’une réponse inventée. Une autre formulation ou un autre réglage peut changer le résultat ; une prise en charge française fiable demanderait une adaptation du corpus ou du modèle d’embeddings, suivie d’une nouvelle évaluation.

## Vérifications du front

- [ ] Le mode affiché correspond à la configuration : **Retrieval only** sans LLM.
- [ ] Le message saisi et le résultat apparaissent, avec un chargement compréhensible.
- [ ] Une source s’ouvre et affiche le bon titre ainsi qu’un passage contenant le fait attendu. Consulter plusieurs citations si nécessaire.
- [ ] Le score de similarité est traité comme une mesure de proximité, pas comme une probabilité de vérité.
- [ ] Dans Research, **Retrieval trace** affiche les sources réellement utilisées et les paramètres de recherche.
- [ ] Une conversation peut être renommée, puis retrouvée après actualisation en cliquant dans l’historique.
- [ ] Le bouton **+** du chatbot démarre une nouvelle conversation ; **Open chat in Research** ouvre celle déjà commencée.
- [ ] La suppression d’une conversation retire ses messages. Les événements statistiques restent normalement conservés ; le nettoyage administratif demandé le 1er novembre a aussi effacé ces événements anciens.
- [ ] À 390 px de largeur, les contrôles, citations et zone de saisie restent utilisables.
- [ ] Après de nouveaux essais, Overview et Intelligence comptent les véritables requêtes effectuées.

Pour les tests de suivi, reformuler le sujet dans chaque question : la recherche vectorielle utilise le message courant. Par exemple, préférer « Who approves remote work from another country? » à une question ambiguë comme « And who approves it? ».

## Ce qui a réellement été vérifié

Le 1er novembre 2026, les questions RH anglaises ci-dessus ont été soumises au véritable service de recherche et à Qdrant avec top_k = 5 et score_threshold = 0,30. Le document principal attendu a été retrouvé pour chaque formulation finale. RH09 a été précisée après une première formulation qui ne retrouvait pas le document d’intégration.

Cette vérification porte sur la présence du document attendu parmi les résultats, pas sur une mesure de justesse des réponses générées. Les éléments attendus ont été lus dans les documents sources ; leur couverture exacte par les extraits et leur présentation dans le front restent les critères du test manuel. Aucun fournisseur LLM n’a été invoqué.

Les recherches de préparation ont été exécutées dans une transaction SQL en lecture seule, sans enregistrer de conversations, de messages ou de nouveaux événements de requête. Le nettoyage a laissé **0 conversation, 0 message et 0 événement de requête**, en conservant **20 documents et 100 passages indexés**. Les questions que vous enverrez ensuite dans le front créeront naturellement un nouvel historique.
