#!/usr/bin/env bash
#
# Alles wat jouw inloggegevens nodig heeft, in één commando.
#
#   ./scripts/ship.sh                       # commit met een automatische boodschap
#   ./scripts/ship.sh "wat je hebt gedaan"  # commit met je eigen boodschap
#   ./scripts/ship.sh --env                 # ook de sleutels uit .env.local naar Vercel
#   ./scripts/ship.sh --dry                 # laat zien wat er zou gebeuren
#   ./scripts/ship.sh --force               # pushen ook al is de controle rood
#   ./scripts/ship.sh --full                # ook de schrijvende testruns (duurt minuten)
#
# Vóór het pushen draait een controle: TypeScript en elke leesaudit die deze
# repo heeft (`audit-*.mts` en de niet-schrijvende testruns). Wat niet bestaat
# wordt overgeslagen — het script is hetzelfde in alle repo's, de inhoud van de
# controle verschilt per repo. Is er iets rood, dan gaat er niets live. Dat is de enige manier waarop wat vandaag klopt ook morgen nog
# klopt — een fout die de test vindt, kan zo simpelweg niet meer gedeployed
# worden. `--full` draait ook de testruns die echt verkopen en bestellingen
# doorlopen; die schrijven in productie (met TEST-ids) en ruimen zichzelf op.
#
# Waarom dit bestaat: het schrijven en testen gebeurt in de sessie, maar
# committen, pushen en Vercel hebben sleutels nodig die alleen op deze machine
# staan. Dat is het enige wat overblijft — en het hoort één handeling te zijn,
# geen rij commando's die je overtypt.
#
# Deployen gebeurt vanzelf: de repo hangt aan GitHub, dus een push naar `main`
# start de productiebuild. `vercel --prod` is alleen nodig als je buiten git om
# iets wilt uitrollen.

set -euo pipefail
cd "$(dirname "$0")/.."
REPO=$(basename "$PWD")

DRY=0
ENVPUSH=0
FORCE=0
FULL=0
BOODSCHAP=""
for arg in "$@"; do
  case "$arg" in
    --dry) DRY=1 ;;
    --force) FORCE=1 ;;
    --full) FULL=1 ;;
    --env) ENVPUSH=1 ;;
    *) BOODSCHAP="$arg" ;;
  esac
done

run() { if [ "$DRY" = 1 ]; then echo "   … $*"; else "$@"; fi }

# ── 1. Eerst de sleutels, dan pas pushen ─────────────────────────────────────
# Volgorde is niet vrijblijvend: een push start meteen de build, en die pakt de
# omgevingsvariabelen zoals ze op dát moment op Vercel staan. Zet je ze erna,
# dan draait er een build met de oude waarden en moet je alsnog opnieuw
# uitrollen. Daarom hier, vóór de commit.
#
# Deze sleutels veranderen zelden en een verkeerde waarde legt de formulieren
# plat, dus alleen op verzoek — en met een controle vooraf: een sleutelpaar dat
# niet bij elkaar hoort, of een secret die Cloudflare zelf afkeurt, gaat er niet
# in. Beide fouten hebben we in het echt gehad.
if [ "$ENVPUSH" = 1 ]; then
  echo "── Sleutels naar Vercel ──"
  SECRET=$(sed -n 's/^TURNSTILE_SECRET_KEY=//p' .env.local | tr -d '"\r')
  SITE=$(sed -n 's/^NEXT_PUBLIC_TURNSTILE_SITE_KEY=//p' .env.local | tr -d '"\r')

  if [ -z "$SECRET" ] || [ -z "$SITE" ]; then
    echo "   ✗ sitekey of secret ontbreekt in .env.local — niets gedaan"; exit 1
  fi
  # Sitekey en secret van hetzelfde widget delen hun voorvoegsel.
  if [ "${SECRET:0:12}" != "${SITE:0:12}" ]; then
    echo "   ✗ sitekey en secret komen van verschillende widgets — niets gedaan"; exit 1
  fi
  if curl -s -X POST https://challenges.cloudflare.com/turnstile/v0/siteverify \
       -d "secret=$SECRET" -d "response=XXXX.DUMMY.TOKEN.XXXX" | grep -q invalid-input-secret; then
    echo "   ✗ Cloudflare keurt deze secret af — niets gedaan"; exit 1
  fi

  # Behalve de Turnstile-sleutels ook de webhook-sleutel: zonder die staat
  # /api/mailchimp-sync dicht (503), en daarvóór stond hij open.
  for V in NEXT_PUBLIC_TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY SANITY_WEBHOOK_SECRET; do
    VAL=$(sed -n "s/^$V=//p" .env.local | tr -d '"\r')
    if [ -z "$VAL" ]; then echo "   · $V staat niet in .env.local — overgeslagen"; continue; fi
    if [ "$DRY" = 1 ]; then echo "   … $V naar Vercel"; continue; fi
    vercel env rm "$V" production --yes >/dev/null 2>&1 || true
    # Via stdin, nooit als argument: een argument staat in de procestabel.
    printf '%s' "$VAL" | vercel env add "$V" production >/dev/null && echo "   ✓ $V"
    unset VAL
  done
  unset SECRET SITE
  echo
fi

# ── 1b. Controle vóór het pushen ─────────────────────────────────────────────
# Alleen als er code is veranderd; voor een lege push hoeft dit niet.
if [ "$DRY" = 0 ] && [ "$FORCE" = 0 ] && [ -n "$(git status --porcelain)" ]; then
  echo "── Controle vóór het pushen ──"
  ROOD=0
  stap() {
    local naam="$1"; shift
    if "$@" >/tmp/ship-check.log 2>&1; then
      echo "   ✓ $naam"
    else
      echo "   ✗ $naam"
      # Nooit zwijgen. `grep` zonder treffer geeft exit 1, en met set -e stopte
      # dáár het hele script — zonder "Er is iets rood", zonder de reden. Dus:
      # de fouten tonen als ze er zijn, anders de laatste regels van het log.
      { grep -E "✗|error TS|Error|niet geïnstalleerd|not found" /tmp/ship-check.log || tail -n 6 /tmp/ship-check.log; } | head -8 | sed 's/^/       /' || true
      ROOD=1
    fi
  }
  stap "TypeScript" npx tsc --noEmit

  # Lopen de twee templates uit elkaar?
  #
  # `sync-shared.mjs` bestond al, maar niets riep hem aan — dus werd een fix in
  # de ene repo pas in de andere opgemerkt als er iets stuk was. Precies wat er
  # gebeurde met de zoekfout op contacten ("Tessa Testklant"): hier opgelost,
  # daar bleef hij staan. Een gedeeld bestand dat uiteenloopt houdt de push nu
  # tegen.
  #
  # Staat de andere repo er niet (exitcode 2), dan is dat geen fout maar een
  # andere werkplek — overslaan, niet blokkeren.
  if [ -f scripts/sync-shared.mjs ]; then
    printf "   … gedeelde code\r"
    node scripts/sync-shared.mjs --check >/tmp/ship-sync.log 2>&1
    case $? in
      0) echo "   ✓ gedeelde code gelijk aan de andere template" ;;
      2) echo "   · gedeelde code niet gecontroleerd (andere repo niet gevonden)" ;;
      *) echo "   ✗ gedeelde code loopt uiteen"
         grep -E "≠" /tmp/ship-sync.log | head -8 | sed 's/^/       /'
         echo "       herstellen: node scripts/sync-shared.mjs --diff, dan --push of --pull"
         ROOD=1 ;;
    esac
  fi

  # De snelle poort: alles wat alleen leest.
  SNEL="audit-tenant audit-theme audit-studio-lists audit-data testrun-print testrun-turnstile"
  for t in $SNEL; do
    [ -f "scripts/$t.mts" ] && stap "$t" npx tsx --env-file=.env.local "scripts/$t.mts"
  done

  # `--full`: élke testrun die er ís, gevonden met een glob in plaats van een
  # lijst. Er stond `testrun-flow` in die lijst; dat bestand bestaat niet, en de
  # `[ -f ]`-controle sloeg het stil over — je dacht dus dat het draaide.
  # Andersom stonden zes bestaande testruns er niet in en draaiden nooit mee.
  #
  # Uitgezonderd: `testrun-tenant`, die wil een lege dataset (zie het script),
  # en `audit-onboarding`, die over de inrichting van een galerie gaat en geen
  # reden mag zijn om code tegen te houden.
  if [ "$FULL" = 1 ]; then
    for f in scripts/testrun-*.mts; do
      t=$(basename "$f" .mts)
      case " $SNEL testrun-tenant " in *" $t "*) continue ;; esac
      stap "$t" npx tsx --env-file=.env.local "$f"
      npx tsx --env-file=.env.local "$f" --cleanup >/dev/null 2>&1 || true
    done
  fi
  if [ "$ROOD" = 1 ]; then
    echo
    echo "Er is iets rood. Niets gepusht."
    echo "Toch pushen (op eigen risico):  ./scripts/ship.sh --force \"$BOODSCHAP\""
    exit 1
  fi
  echo
fi

# ── 2. Wat is er veranderd? ──────────────────────────────────────────────────
# Nooit `git add -A`: dat sleepte ooit werk mee dat nog niet af was. Alleen
# bestanden die git al kent, plus nieuwe bestanden die je hieronder ziet staan.
GEWIJZIGD=$(git diff --name-only; git diff --cached --name-only)
NIEUW=$(git ls-files --others --exclude-standard)

if [ -z "$GEWIJZIGD$NIEUW" ]; then
  echo "Niets gewijzigd in $REPO."
else
  echo "── $REPO ──"
  [ -n "$GEWIJZIGD" ] && echo "$GEWIJZIGD" | sort -u | sed 's/^/   M /'
  [ -n "$NIEUW" ] && echo "$NIEUW" | sed 's/^/   + /'

  if [ -n "$NIEUW" ] && [ "$DRY" = 0 ]; then
    # Van de terminal lezen, niet van stdin: wie twee commando's tegelijk plakt,
    # gaf anders de tweede regel als antwoord — "nee" dus — en het tweede
    # commando werd opgegeten. Geen commit, geen melding, en niemand die het
    # zag. Zonder terminal (CI) is het antwoord altijd nee.
    if [ -t 0 ] || [ -r /dev/tty ]; then
      read -r -p "Nieuwe bestanden meenemen? [j/N] " ja < /dev/tty
    else
      ja=N; echo "Nieuwe bestanden meenemen? [j/N] N  (geen terminal — niet meegenomen)"
    fi
    [ "$ja" = "j" ] || NIEUW=""
  fi

  # shellcheck disable=SC2086
  [ -n "$GEWIJZIGD" ] && run git add $(echo "$GEWIJZIGD" | sort -u | tr '\n' ' ')
  # shellcheck disable=SC2086
  [ -n "$NIEUW" ] && run git add $(echo "$NIEUW" | tr '\n' ' ')

  if [ -z "$BOODSCHAP" ]; then
    BOODSCHAP="update $(date +%Y-%m-%d)"
  fi
  run git commit -m "$BOODSCHAP"
fi

# ── 3. Pushen — dit start de deploy ──────────────────────────────────────────
TAK=$(git rev-parse --abbrev-ref HEAD)
if [ "$TAK" != "main" ]; then
  echo
  echo "Je staat op '$TAK', niet op main. Vercel bouwt productie vanaf main."
  echo "Samenvoegen:  git checkout main && git merge $TAK && ./scripts/ship.sh"
  exit 1
fi
run git push

# Zijn de sleutels gewijzigd maar was er niets te committen, dan komt er geen
# build van de push. Dan alsnog uitrollen, anders draait de oude waarde door.
if [ "$ENVPUSH" = 1 ] && [ -z "$GEWIJZIGD$NIEUW" ] && [ "$DRY" = 0 ]; then
  echo
  echo "Geen codewijziging, dus geen build van de push — opnieuw uitrollen:"
  vercel --prod
fi

echo
echo "Klaar. De build loopt op vercel.com."
