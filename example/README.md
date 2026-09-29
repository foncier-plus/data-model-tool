# Formalisme des objets YAML

Ce document décrit le format des objets manipulés par **Data Flow**.

## 1. Conteneur : le notebook

Un *notebook* est un répertoire (ouvert via File System Access) contenant :

- une **hiérarchie de répertoires** libre ;
- des fichiers **YAML** (`.yaml`, `.yml`) décrivant un ou plusieurs objets ;
- des documents **Markdown** (`.md`, `.markdown`) servant de documentation ;
- des **PDF** et **images** (`.pdf`, `.png`, `.jpg`, …) affichables ;
- éventuellement un fichier **`markdown.css`** à la racine pour personnaliser le rendu Markdown.

La hiérarchie des répertoires est purement organisationnelle : elle n'a aucune incidence sur les namespaces (déclarés dans le YAML) ni sur les relations.

## 2. Fichier YAML multi-documents

Un fichier peut contenir **plusieurs objets**, séparés par `---` :

```yaml
namespace: AZAE
name: bati
description: "Bâtiments."
attributes:
  - name: hauteur
    type: number
---
namespace: AZAE
name: site_eco
attributes:
  - name: site_id
    type: string
```

Chaque document décrit **un objet** et porte son propre `namespace`.

## 3. Champs d'un objet

| Champ | Type | Requis | Défaut | Description |
| --- | --- | --- | --- | --- |
| `namespace` | chaîne (`a.b.c`) | non | *(racine)* | Espace de nommage, segments séparés par `.`. Absent = objet à la racine. Placé **avant** `name`. |
| `name` | chaîne | **oui** | — | Nom de l'objet, unique dans son namespace. |
| `type` | chaîne | non | — | Nature de l'objet (ex. `input`, `output`). |
| `description` | chaîne | non | `""` | Description lisible. |
| `about` | lien wiki | non | `""` | Lien de documentation : `[[chemin.md#section]]` (un seul lien). Placé en **bas** des champs de premier niveau. |
| `attributes` | liste d'attributs | non | `[]` | Attributs **racine** (hors groupe). |
| `groups` | liste de groupes | non | `[]` | Groupes d'attributs. |

### Identité d'un objet

`namespace` + `name` → identifiant qualifié `namespace.name` (ex. `AZAE.bati`).
Sans namespace, l'identifiant est simplement `name`.

## 4. Attribut

| Champ | Type | Requis | Défaut | Description |
| --- | --- | --- | --- | --- |
| `name` | chaîne | **oui** | — | Nom de l'attribut. |
| `type` | chaîne | non | — | Type : `string`, `number`, `integer`, `boolean`, `date`, `datetime`, `enum`, `ref`, `array`. |
| `presence` | `mandatory` \| `optional` | non | `mandatory` | Présence. `optional` remplace l'ancien `optional: true` (toujours accepté en lecture). |
| `example` | chaîne | non | `""` | Exemple de valeur (un nombre est conservé sous forme de texte). |
| `description` | chaîne | non | `""` | Description. |
| `about` | lien wiki | non | `""` | Lien de documentation `[[chemin.md#section]]`. |
| `origin` | objet *Origin* | non | — | Provenance / calcul de l'attribut. |
| *(commentaire)* | commentaire YAML | non | — | Un commentaire `#` placé avant l'attribut est conservé. |

## 5. Groupe

| Champ | Type | Requis | Défaut | Description |
| --- | --- | --- | --- | --- |
| `name` | chaîne | **oui** | — | Nom du groupe. |
| `description` | chaîne | non | `""` | Description. |
| `origin` | objet *Origin* | non | — | Provenance du groupe. |
| `attributes` | liste d'attributs | non | `[]` | Attributs du groupe. |
| *(commentaire)* | commentaire YAML | non | — | Commentaire conservé. |

## 6. Origin (provenance / formule)

| Champ | Type | Requis | Défaut | Description |
| --- | --- | --- | --- | --- |
| `from` | liste de références | non | `[]` | Attributs sources. |
| `formula` | chaîne | non | `""` | Formule / explication du calcul. |

```yaml
origin:
  from: [IGN.BDTOPO.batiment.hauteur, CSTB.BDNB.batiment_construction.hauteur]
  formula: "coalesce(hauteur BDNB, hauteur BD Topo)"
```

Un `origin` vide (`from: []`, `formula: ""`) est supprimé à l'écriture.

## 7. Références

Une référence désigne un **objet** ou un **attribut** :

- `Namespace.objet` → objet ;
- `Namespace.objet.attribut` → attribut ;
- le namespace peut être composé : `IGN.BDTOPO.batiment.hauteur`.

Résolution, dans l'ordre :

1. **relatif au namespace** de l'objet porteur (`<namespace>.<ref>`) ;
2. **relatif au projet** (premier segment du namespace) ;
3. **absolu** (`ref` tel quel).

Pour les **liens entre objets** (graphe), si l'attribut exact n'existe pas, la référence est résolue au **niveau objet** par le plus long préfixe valide : `NS1.ObjectBeta.beta1` → objet `NS1.ObjectBeta`.

## 8. Liens wiki (`about`)

Format : `[[chemin/relatif.md#section]]`

- chemin **relatif au fichier YAML** porteur ;
- `#section` = ancre = slug du titre Markdown (`## Mon Titre` → `mon-titre`) ;
- un seul lien par champ `about`.

À l'ouverture :
- si le fichier n'existe pas → il est **créé** ;
- si la section n'existe pas → le titre `## Section` est **ajouté en fin de document** ;
- le rendu défile jusqu'au titre et le **surligne**.

## 9. Règles de sérialisation (« Prettifier »)

- `namespace` en premier, `name` ensuite ; `about` en bas des champs de premier niveau.
- une **ligne vide** entre chaque attribut, entre chaque groupe et entre les attributs d'un groupe ;
- une ligne vide avant les sections `attributes:` / `groups:` ;
- séparateur `---` entre documents, sans règle de lignes vides ajoutée automatiquement.

## 10. Tableau de correspondance (convertible en objet)

Table du schéma, directement convertible en objet (zod / JSON Schema) :

| chemin | clé | type | cardinalité | requis | défaut | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `object` | `namespace` | `string` | 1 | non | `""` | segments `.` |
| `object` | `name` | `string` | 1 | **oui** | — | min 1 |
| `object` | `type` | `string` | 1 | non | — | ex. `input`, `output` |
| `object` | `description` | `string` | 1 | non | `""` | |
| `object` | `about` | `wikilink` | 1 | non | `""` | `[[file.md#section]]` |
| `object` | `attributes` | `attribute[]` | n | non | `[]` | |
| `object` | `groups` | `group[]` | n | non | `[]` | |
| `attribute` | `name` | `string` | 1 | **oui** | — | min 1 |
| `attribute` | `type` | `string` | 1 | non | — | `string`\|`number`\|`integer`\|`boolean`\|`date`\|`datetime`\|`enum`\|`ref`\|`array` |
| `attribute` | `presence` | `enum` | 1 | non | `mandatory` | `mandatory`\|`optional` |
| `attribute` | `example` | `string` | 1 | non | `""` | nombres convertis en texte |
| `attribute` | `description` | `string` | 1 | non | `""` | |
| `attribute` | `about` | `wikilink` | 1 | non | `""` | |
| `attribute` | `origin` | `origin` | 0..1 | non | — | |
| `attribute` | `_comment` | `string` | 1 | non | `""` | commentaire YAML |
| `group` | `name` | `string` | 1 | **oui** | — | min 1 |
| `group` | `description` | `string` | 1 | non | `""` | |
| `group` | `origin` | `origin` | 0..1 | non | — | |
| `group` | `attributes` | `attribute[]` | n | non | `[]` | |
| `group` | `_comment` | `string` | 1 | non | `""` | commentaire YAML |
| `origin` | `from` | `ref[]` | n | non | `[]` | références |
| `origin` | `formula` | `string` | 1 | non | `""` | |

### Schéma condensé

```json
{
  "object": {
    "namespace": "string",
    "name": "string (requis)",
    "type": "string?",
    "description": "string = ''",
    "about": "wikilink = ''",
    "attributes": "attribute[] = []",
    "groups": "group[] = []"
  },
  "attribute": {
    "name": "string (requis)",
    "type": "string?",
    "presence": "'mandatory' | 'optional' = 'mandatory'",
    "example": "string = ''",
    "description": "string = ''",
    "about": "wikilink = ''",
    "origin": "origin?"
  },
  "group": {
    "name": "string (requis)",
    "description": "string = ''",
    "origin": "origin?",
    "attributes": "attribute[] = []"
  },
  "origin": {
    "from": "string[] = []",
    "formula": "string = ''"
  }
}
```

## 11. Exemple complet

```yaml
namespace: NS1
name: ObjectAlpha
description: "Object A for example"
about: "[[documentation.md#object-alpha]]"

attributes:
  - name: alpha_1
    type: string

  - name: alpha_2
    type: integer

groups:
  - name: "Group of attributes #1"
    attributes:
      - name: alpha_3
        type: boolean
        origin:
          from: [NS1.ObjectBeta.beta1]
          formula: "description de la formule"

  - name: "Group of attributes #2"
    attributes:
      - name: alpha_4
        type: string
        presence: optional
        example: "jello"
        origin:
          from: [NS2.ObjectDelta.delta1]
          formula: "description de la formule"
```
