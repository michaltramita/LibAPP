# Libo AI integrácia

## Architektúra
- **Klient (React)**: komponent `LiboChat` posiela správy na `/api/chat` a zobrazí streamované tokeny. Nástroje (navigate, searchFeature, showGuide, openSettings) mapuje na akcie v routeri cez utilitu `liboTools`.
- **Serverless API**: endpoint `/api/chat` (SSE) zostaví systémový a developer prompt, pridá kontext z lokálnych FAQ (light RAG) a streamuje odpoveď. Callback `/api/chat/tool-callback` slúži na potvrdenie akcií.
- **LLM klient**: OpenAI kompatibilný, model a teplota z env, nástrojové volania povolené.

## Prompty
- **System**: „Si Libo… primárny jazyk slovenčina, ak je otázka v EN, prepni do EN. Buď stručný, krokový, nevymýšľaj neexistujúce obrazovky.“
- **Developer**: doplňujúci kontext z FAQ + pokyn na používanie nástrojov.

## Bezpečnosť a guardrails
- Env prepínač `LIBO_AI_ENABLED`, kľúč `OPENAI_API_KEY` len na serveri.
- Detekcia citlivých údajov (`rodné číslo`, IBAN, adresa) -> bezpečné odmietnutie.
- Telemetria anonymná: len metaúdaje relácie a časová pečiatka.

## Limity
- Jednoduché textové embeddingy (kosínus) na lokálne FAQ.
- SSE stream je best-effort; pri vypnutom AI sa odošle fallback odpoveď.

## Príklady použitia
- „Kde zmením heslo?“ -> Libo zavolá `openSettings`/`navigate` na bezpečnostnú sekciu.
- „Ako pridať nového používateľa?“ -> odpoveď s krokmi + `showGuide('add-user')`.
