# Exec Plan 0004: Stair System Visual Quality And Variant Acceptance

## Cel

Zrobic generator schodow tak, zeby wszystkie wspierane warianty wygladaly i zachowywaly sie jak prawdziwe schody stalowe, a nie tylko jak zbior losowo ustawionych memberow, plyt, szyb i srub.

Ten plan jest osobnym planem jakosciowym dla `stair-system`. Plan 0003 opisuje architekture Smart Componentow. Ten plan opisuje, jak doprowadzic schody do poprawnej geometrii, poprawnych polaczen, poprawnej balustrady i powtarzalnej akceptacji wizualnej.

## Twarde zasady

- Nie hardcodowac schodow w app core.
- Generator schodow zostaje w `bobercad/data/libraries/smart-components/components/stairs`.
- App core moze dostac tylko generyczne API potrzebne tez dla bram, ram, platform i innych generatorow.
- Project JSON nadal przechowuje normalne semantyczne obiekty: members, plates, features, holePatterns, fastenerGroups, welds, assemblies, smartComponentInstances.
- Nie zapisywac mesh, B-rep, triangles, scene data ani wygenerowanej geometrii renderera do JSON.
- Polaczenia schodow sa Smart Componentami lub normalnymi obiektami wygenerowanymi przez Smart Component API.
- Nested Smart Components musza dzialac: caly stair-system zawiera flights, landings, supports, treads, railings, connections, sections.
- Kazdy wygenerowany element musi miec stabilny role id, zeby edycje, override, detach i reset byly przewidywalne.
- Nie konczyc pursue goal, dopoki cala macierz wariantow nie przejdzie automatycznych checkow i recenzji wizualnej subagenta.

## Co znaczy "poprawne schody"

Wariant schodow przechodzi tylko wtedy, gdy wszystkie ponizsze obszary sa poprawne.

- Geometria trasy
  - flighty ida po zamierzonej trasie
  - landing jest poziomy i laczy flighty bez skretow przez elementy
  - stopnie sa rowno rozstawione po walking line
  - rise, going, width i floor-to-floor sa spojne
  - spiral/helical/winder maja logiczny wewnetrzny i zewnetrzny promien
  - nie ma odwracania stopni, przecinania flightow ani losowych skosow

- Stopnie
  - stopnie sa poziome
  - stopnie maja prawidlowy ksztalt dla trasy: prostokat, klin, trapez, luk, grating, folded tray, pan
  - folded tray ma zagiecia jako `fabrication.bends`, a drewno/powierzchnia uzytkowa lezy na gorze
  - sruby stopni trafiaja w realne plyty/cleaty, nie wisza w powietrzu
  - stopnie nie koliduja ze stringerami, landingami ani balustrada

- Supporty i stringery
  - twin stringer idzie po obu bokach flightu
  - mono stringer idzie pod osia lub wskazanym offsetem
  - spiral column jest centralny i wspiera stopnie spiralne
  - segmenty stringerow lacza sie logicznie na landingach i splitach
  - stringery nie przechodza przez stopnie w losowych miejscach
  - profile, rotacje i cardinal point sa konsekwentne

- Landingi
  - landing ma plyte lub rame nosna
  - landing laczy flighty w jednej wysokosci
  - landing ma supporty, nie wisi bez mocowania
  - landing ma krawedzie zgodne z szerokoscia schodow i kierunkiem turnu
  - balustrada przechodzi przez landing bez pustych przerw

- Balustrada
  - slupki sa pionowe
  - slupki stoja na stopniach/stringerze/landingach albo maja wlasne base plates
  - handrail jest ciagly po stronie wymaganej przez wariant
  - nie ma pustych przerw na landingach, turnach, koncach flightow i splitach
  - glass panels sa segmentowane miedzy slupkami i nie przechodza przez stopnie
  - rail post base plates maja sruby/anchor bolts
  - wysokosc balustrady i spacing slupkow sa sprawdzane przez rule pack albo diagnostyke generatora

- Polaczenia i mocowania
  - floor base plates sa przy dolnym koncu i maja anchor bolts
  - top slab / floor connection jest przy gornym koncu i ma realne plyty oraz anchor bolts
  - standard-hardware ma bearing cleats/brackets lub inne wybrane mocowanie tread-to-support
  - post base plates sa przy kazdym slupku, nie tylko przy czesci slupkow
  - transport split ma splice plates/flanges i sruby w miejscach splitu
  - bolt groups trafiaja w holePatterns i host plates
  - nie ma srub wiszacych poza plyta, w szybie bez otworu, albo w pustce

- Sekcje transportowe
  - split po masie/dlugosci/manual stations tnie schody w miejscach, ktore da sie wykonac i zmontowac
  - kazda sekcja ma swoje assemblies i liste obiektow
  - split tworzy polaczenia montazowe, nie tylko rozcina role
  - maksymalna waga/rozmiar sekcji jest policzona i pokazana w diagnostics/schedule

- Edycja
  - klikniecie `Pick Smart Component` wybiera caly stair-system
  - nadal mozna wejsc w direct child component, jezeli trzeba fine tune
  - zmiana parametrow regeneruje te same role id
  - przesuniecie membera dziecka zapisuje override albo detach zgodnie z lifecycle
  - parent regeneration nie kasuje recznego fine tune bez jawnej akcji reset/reattach

## Macierz wariantow do akceptacji

Kazdy wariant z tej listy musi miec automatyczne checki, screenshoty i recenzje subagenta.

| Demo id | Project file | Co musi udowodnic |
| --- | --- | --- |
| `stair-system-straight-basic` | `sample_stair_straight_basic.json` | bazowy prosty flight, twin stringers, folded/wood tread, base/top fixings, pelna balustrada |
| `stair-system-straight-landing` | `sample_stair_straight_with_landing.json` | prosty flight z landingiem posrednim i ciagla balustrada przez landing |
| `stair-system-l-shape` | `sample_stair_l_shape.json` | turn 90 stopni, landing, stringery i balustrada bez przecinania |
| `stair-system-u-switchback` | `sample_stair_u_switchback.json` | dwa flighty przeciwne, landing, wewnetrzne/zewnetrzne rail sides |
| `stair-system-winder` | `sample_stair_winder.json` | klinowe stopnie na zakrecie, ciagly support i balustrada |
| `stair-system-curved` | `sample_stair_curved.json` | curved walking line, stopnie po luku, stringery po offsetach |
| `stair-system-spiral` | `sample_stair_spiral.json` | central column, radial treads, railing po zewnetrznej stronie |
| `stair-system-helical` | `sample_stair_helical.json` | helix, plynny support, brak losowych prostych segmentow przez srodek |
| `stair-system-mono-stringer` | `sample_stair_mono_stringer.json` | mono stringer, wall handrail, brak bocznych twin stringerow |
| `stair-system-grating-treads` | `sample_stair_grating_treads.json` | grating tread family i poprawne mocowania gratingu |
| `stair-system-glass-rail` | `sample_stair_glass_rail.json` | glass railing, panele bez luk i bez kolizji ze stopniami |
| `stair-system-split-weight` | `sample_stair_transport_split_weight.json` | sekcje po wadze, splice hardware na splitach |
| `stair-system-manual-split` | `sample_stair_manual_split.json` | reczne split stations i logiczne polaczenia montazowe |
| `stair-system-compliance-failures` | `sample_stair_compliance_failures.json` | geometria nadal czytelna, ale diagnostics pokazuja oczekiwane bledy Part K |

Po tych wariantach dodac macierz kombinacji rodzin:

- route family x tread family
- route family x support family
- route family x railing family
- route family x connection family
- section strategy x connection family

Nie trzeba robic pelnego iloczynu kartezjanskiego, ale kazda rodzina musi byc pokazana w przynajmniej jednym wariancie pozytywnym i jednym wariancie granicznym.

## Ryzyka znalezione w obecnym kodzie

Te punkty wynikaja z przegladu obecnych plikow `scripts/generate_stair_samples.mjs` i `bobercad/data/libraries/smart-components/components/stairs/**`. Musza byc zamkniete w implementacji albo opisane jako celowo odlozone, zanim warianty dostana PASS.

- Spiral/helical sa obecnie ryzykowne, bo layout wyglada jak planowy arc, a nie pelna helisa z poprawnym Z po stacji.
- Curved/winder maja za malo kontroli walking line, promieni, samoprzeciec i ciaglosci stycznych.
- Wszystkie trasy moga uzywac prostokatnych treadow, co jest zle dla winder, curved, spiral i helical.
- Brakuje kontroli inner going, outer going, nosing overlap, zamknietych riserow i kolizji stopni.
- Sample nie pokrywaja wystarczajaco `plate-tread`, `pan-tread` i `closedRisers`.
- Opisy sample musza zgadzac sie z realnym outputem, na przyklad folded-tray nie moze byc opisany jako plate tread z weldami, jezeli weldow jest zero.
- Curved/spiral/helical supporty sa ryzykowne, jezeli sa tylko prostymi segmentami bez rolled/curved stringerow, miterow, trimow i bearing/notch pod stopnie.
- Mapowanie tread-to-support nie moze brac pierwszych supportow globalnie; musi laczyc stopien z jego lokalnym supportem/segmentem.
- Landingi nie moga byc tylko prostokatnym frame wrzuconym w trase; musza miec pewna geometrie naroznika i interfejsy do flightow.
- Balustrada nie moze byc tylko prostymi odcinkami po stacjach calej trasy; musi kontrolowac landing gaps, corner continuity, curved panels i wall-anchor.
- Obecne sample maja ryzyko `interfaces:0` i `connectionZones:0`; dla polaczen trzeba zapisac realne interfaces/zones albo jawnie uzasadnic inny generyczny model.
- Parametr `weldSize` nie wystarcza; jezeli wariant ma weldy, musza powstac normalne weld objects.
- Fastenery i otwory musza sprawdzac zgodnosc przez wszystkie uczestniczace obiekty, nie tylko jedna host plate.
- Stare stair-only connection families sa usuniete. `standard-hardware` i `member-splice` potrzebuja osobnych sample i osobnej oceny wizualnej jako generyczne connection components.
- Stringer splice nie moze konczyc sie na plytach bez srub/otworow.
- `manualStations` nie moze tylko zwiekszac liczby sekcji; musi faktycznie ciac po stacjach i tworzyc hardware splitu.
- `sections.strategy = landings` nie moze byc tylko count-based; split musi byc przestrzennie powiazany z landingami.
- `max-weight` nie moze byc greedy po kolejnosci obiektow bez spojnosci przestrzennej sekcji.
- Masa sekcji musi uwzgledniac members, plates, fasteners i material library, a nie tylko default steel plates.
- Viewer QA musi robic screenshoty/pixel checks wszystkich wariantow schodow, nie tylko generic geometry check.
- Sample generation musi uruchamiac per-file schema validation i expected counts/diagnostics dla kazdego `sample_stair_*.json`.
- Base project nie moze niesc przypadkowych ustawien z `sample_fin_plate.json`; trzeba sprawdzic `modelDefaults`, reference metadata i odziedziczone migration notes.

## Artefakty QA

Dla kazdego uruchomienia QA tworzyc katalog:

```text
artifacts/stair-qa/<run-id>/
```

Struktura:

```text
artifacts/stair-qa/<run-id>/
  manifest.json
  summary.md
  variants/
    <demo-id>/
      project.json
      model-summary.json
      diagnostics.json
      screenshots/
        top.png
        axonometric.png
        elevation-left.png
        elevation-right.png
        detail-base.png
        detail-top-slab.png
        detail-tread-fixing.png
        detail-railing.png
      review-request.md
      subagent-review.md
      status.json
```

`manifest.json` musi miec:

- git commit albo working tree marker
- timestamp
- lista demo ids
- URL viewer dla kazdego demo
- status automatycznych checkow
- status recenzji subagenta

## Wymagane screenshoty

Dla kazdego wariantu zrobic minimum te widoki:

- `top.png`
  - kamera z gory, patrzy po osi Z
  - ma pokazac trase, szerokosc, landingi, kierunki flightow, rail sides
  - musi byc widac, czy nic nie przecina sie planie

- `axonometric.png`
  - kamera aksonometryczna
  - ma pokazac caly obiekt jako klient go zobaczy
  - ten widok jest najwazniejszy dla oceny "czy wyglada jak schody"

- `elevation-left.png`
  - elewacja z boku glownej trasy albo lokalnego flightu
  - ma pokazac rise, going, slope stringerow, wysokosc balustrady, polaczenia dolne i gorne

- `elevation-right.png`
  - druga strona, gdy wariant ma balustrade/supporty po obu stronach albo asymetrie
  - dla jednostronnego wall handrail moze byc opisane jako "not applicable", ale tylko gdy `status.json` ma powod

Dodatkowe detale sa wymagane, jezeli wariant ma dany element:

- `detail-base.png` dla floor base plates i anchor bolts
- `detail-top-slab.png` dla top slab/floor fixing
- `detail-tread-fixing.png` dla srub stopni, cleatow, grating clips
- `detail-railing.png` dla post bases, glass clamps, infill panel gaps
- `detail-split.png` dla transport splitow

## Opis wysylany do subagenta

Do subagenta wysylac nie tylko obrazy, ale tez krotki opis intencji wariantu.

Template:

```text
Ocen wariant schodow: <demo-id>.

Intencja:
- route: <straight / landing / L / U / winder / curved / spiral / helical>
- treads: <folded tray / grating / pan / plate / timber finish>
- supports: <twin stringer / mono stringer / spiral column>
- railings: <post-and-rail / glass / wall handrail / sides>
- connections: <tread fixing / base fixing / top slab fixing / split fixing>
- compliance: <uk-part-k / none / expected-fail>

Masz screenshoty:
- top
- axonometric
- elevation-left
- elevation-right
- details if present

Ocen tylko po tym, czy wygenerowany model wyglada jak poprawne schody stalowe.
Nie dawaj PASS, jezeli cos wyglada losowo, pokracznie, przecina sie, wisi w powietrzu albo ma brakujace mocowania.

Rubryka:
1. Geometria: PASS/FAIL + uwagi
2. Stopnie/supporty/landingi: PASS/FAIL + uwagi
3. Polaczenia/mocowania: PASS/FAIL + uwagi
4. Balustrada: PASS/FAIL + uwagi
5. Sekcje/splity, jesli dotyczy: PASS/FAIL/NA + uwagi
6. Ogolny realizm wykonawczy: PASS/FAIL + uwagi

Wynik koncowy wariantu:
- PASS tylko gdy wszystkie wymagane rubryki sa PASS albo NA z uzasadnieniem
- FAIL gdy choc jedna wymagana rubryka jest FAIL
- NEEDS_MORE_VIEW gdy brakuje widoku do oceny
```

Subagent nie moze zatwierdzac wariantu na podstawie jednego widoku. Jezeli screenshot jest nieczytelny, subagent ma zwrocic `NEEDS_MORE_VIEW`, a nie zgadywac.

## Twarda regula pursue goal

Pursue goal mozna zakonczyc tylko wtedy, gdy:

- `node .\scripts\check_repo.js` przechodzi
- `node .\scripts\generate_stair_samples.mjs` przechodzi
- kazdy JSON sample schodow przechodzi schema validation
- kazdy demo id z macierzy laduje sie w viewerze bez nowych error logs
- dla kazdego demo istnieja wymagane screenshoty
- dla kazdego demo `subagent-review.md` ma finalny status `PASS`
- `summary.md` pokazuje `PASS` dla geometrii, polaczen i balustrady w kazdym wariancie
- wariant `stair-system-compliance-failures` ma oczekiwane diagnostics, ale nie ma wizualnego chaosu

Jezeli jeden wariant nie przejdzie, goal nadal trwa.

## Plan zadan w kolejnosci

### 1. Zapisac stan bazowy i nie udawac, ze jest OK

- Otworzyc wszystkie demo schodow z `viewer-settings.json`.
- Zrobic pierwsze screenshoty obecnego stanu.
- Oznaczyc obecny stan jako baseline `FAIL`.
- Dla kazdego wariantu zapisac najwieksze problemy widoczne w axonometric view.
- Nie poprawiac losowo pojedynczego obrazka bez zapisania przyczyny w planie naprawy.

### 2. Zrobic narzedzie QA do widokow

- Dodac skrypt, na przyklad `scripts/qa_stair_variants.mjs`.
- Skrypt ma iterowac po demo ids z macierzy.
- Skrypt ma otwierac viewer URL `bobercad/app/ui/viewer/index.html?demo=<demo-id>&run=<run-id>`.
- Skrypt ma czekac, az tytul, meta i canvas sa gotowe.
- Skrypt ma zapisywac screenshoty top, axonometric, elevation-left, elevation-right.
- Skrypt ma zapisywac detail screenshoty dla base, top slab, tread fixing, railing i splitow.
- Skrypt ma zapisywac `model-summary.json` z countami: members, plates, features, holePatterns, fastenerGroups, welds, assemblies, smart components.
- Skrypt ma zapisywac `diagnostics.json` z top-level i child Smart Component diagnostics.
- Skrypt ma zapisac `review-request.md` dla subagenta.
- Skrypt nie moze oceniac ladnosci sam. Ma tylko zebrac material.

### 3. Zrobic automatyczne checki geometrii przed recenzja wizualna

- Sprawdzic brak `NaN`, `Infinity`, pustych osi i zerowych wektorow.
- Sprawdzic, ze wszystkie object ids sa w `objectIndex`.
- Sprawdzic, ze wszystkie role ids sa stabilne po regeneracji.
- Sprawdzic, ze kazdy generated object ma collection zgodna z typem.
- Sprawdzic, ze kazdy bolt group ma `fastenerRef`, `holePatternRef` albo jawny zapis pozycji zgodny z obecnym modelem.
- Sprawdzic, ze kazdy hole pattern ma host object albo reference plane.
- Sprawdzic, ze kazda plate ma center, normal, localAxisY, localAxisZ, thickness i shape.
- Sprawdzic, ze kazdy member ma start/end o sensownej dlugosci.
- Sprawdzic, ze kazdy child smart component ma `parentInstanceId`.
- Sprawdzic, ze top-level stair-system zawiera dzieci support/treads/connections/railing, a dla landing route takze landing.

### 4. Zrobic checki specyficzne dla schodow

- Rise:
  - suma rise ma dojsc do floor-to-floor
  - kazdy step rise musi byc rowny w granicy tolerancji
  - compliance failure sample moze miec bledny rise, ale geometria musi byc spojna

- Going:
  - treads musza isc monotonicznie po walking line
  - going nie moze byc ujemny albo zerowy
  - winder/spiral musza miec poprawna szerokosc na walking line

- Treads:
  - kazdy tread top plane musi byc poziomy
  - kazdy tread musi miec sensible width/depth
  - tread count musi odpowiadac parametrom
  - timber/grating/pan/folded tray nie moga zajmowac tej samej przestrzeni w niekontrolowany sposob

- Supports:
  - twin stringer musi miec lewy i prawy stringer po bokach flightu
  - mono stringer musi miec jeden glowny support pod flightem
  - spiral column musi przechodzic przez centrum spiralnych stopni
  - stringery nie moga przecinac landingow i stopni w losowych miejscach

- Landings:
  - landing elevation musi byc rowny koncowi poprzedniego flightu i poczatkowi nastepnego
  - landing musi miec support albo frame
  - landing musi miec railing continuation

- Railings:
  - slupki musza byc pionowe
  - handrail musi laczyc slupki w logicznej kolejnosci
  - glass panels musza siedziec miedzy slupkami
  - maksymalna przerwa w balustradzie musi byc sprawdzana
  - rail nie moze przechodzic przez walking area

- Connections:
  - kazdy tread musi miec mocowanie do supportu albo jawny wariant bez mocowania z diagnostyka
  - kazdy rail post musi miec base plate albo jawny wariant wall mount
  - dolny koniec musi miec floor fixing
  - gorny koniec musi miec top slab/floor fixing
  - split musi miec splice hardware
  - fasteners musza lezec na host plate/cleat/bracket, nie w pustce

### 5. Naprawic model layoutu zanim naprawia sie rodziny

- W `stair-system/solver.mjs` rozdzielic solved layout od generowania obiektow.
- Solver ma zwracac jedno zrodlo prawdy:
  - route segments
  - flight segments
  - landing segments
  - walking line stations
  - side offsets
  - tread frames
  - support frames
  - railing path frames
  - connection points
  - section split stations
- Kazda rodzina musi korzystac z tych samych solved frames.
- Nie dopuszczac, zeby tread, support i railing liczyly inny kierunek trasy osobno.
- Dla route z turnem zapisac lokalne uklady dla kazdego flightu i transition zone.
- Dla curved/spiral/helical zapisac frames po stacjach, a nie losowe proste segmenty.

### 6. Naprawic generator top-level stair-system

- `stair-system/build.mjs` ma tylko skladac system z dzieci.
- Nie powinien tworzyc geometrii, ktora nalezy do rodziny child componentu.
- Ma przekazywac dzieciom solved layout przez jawne inputy.
- Ma tworzyc assemblies dla:
  - whole stair
  - flights
  - landings
  - railings
  - transport sections
- Ma tworzyc child roles stabilnie:
  - `flight:<index>`
  - `landing:<index>`
  - `support:<index>`
  - `treads:<index>`
  - `railing:<side>:<segment>`
  - `connections:<connection-kind>:<index>`
  - `section:<index>`
- Ma generowac diagnostics, gdy wybrana rodzina nie wspiera danej trasy.

### 7. Naprawic stopnie

- Najpierw naprawic straight folded tray z timber top, bo to jest benchmark.
- Potem plate tread.
- Potem grating tread.
- Potem pan tread.
- Potem winder/spiral/helical tread shapes.
- Dla kazdego typu stopnia:
  - zdefiniowac top walking surface
  - zdefiniowac nosing/front edge
  - zdefiniowac left/right/back edges
  - zdefiniowac thickness i `fabrication.bends` jezeli dotyczy
  - zdefiniowac mocowania do supportu
  - zdefiniowac material/finish
- Stopnie nie moga byc tylko plaska blacha, jezeli wariant ma pokazywac finished stair.
- Timber board ma miec osobna plate/material albo jawna semantic finish.
- Sruby drewna maja trafiac w board/tray zgodnie z patternem.

### 8. Naprawic supporty i stringery

- Twin stringer:
  - generowac lewy i prawy stringer po side offsets
  - zachowac ciaglosc przez straight flight
  - na landingach konczyc lub laczyc segmenty logicznie
  - na splitach dodac splice plates
  - cardinal point i rotation profilu ustawic konsekwentnie

- Mono stringer:
  - prowadzic pod walking line albo offsetem z parametru
  - dodac tread brackets, jezeli stopnie nie moga lezec bezposrednio na profilu
  - rail/wall handrail nie moze zakladac twin stringera

- Spiral column:
  - kolumna centralna musi byc pionowa
  - stopnie musza miec wsporniki do kolumny albo jawny bracket
  - zewnetrzna balustrada musi isc po promieniu zewnetrznym

### 9. Naprawic landingi

- Framed landing:
  - outer frame
  - cross members
  - deck/plate
  - connection to incoming/outgoing stringers
  - railing continuation

- Plate landing:
  - plate/deck
  - edge stiffeners albo support frame, jezeli potrzebne
  - bolt/weld options

- Dla L/U/switchback:
  - landing orientation musi wynikac z route
  - flighty musza start/end na krawedziach landingu
  - balustrada musi przejsc przez naroza

### 10. Naprawic balustrady

- Najpierw post-and-rail jako benchmark.
- Potem glass-panel.
- Potem wall-handrail.
- Dla kazdego rail segmentu uzyc railing path z solvera.
- Slupki rozstawic po path stations, nie po indeksach stopni bez kontroli.
- Dodac regule max post spacing.
- Dodac slupki przy:
  - dolnym koncu
  - gornym koncu
  - poczatku/koncu landingu
  - turnach
  - splitach
- Handrail ma byc ciagly:
  - segmenty lacza sie nad slupkami
  - brak pustych przerw
  - brak diagonalnych skokow przez scene
- Glass panels:
  - panel miedzy dwoma sasiednimi slupkami
  - panel nie przechodzi przez stopnie
  - panel ma clamp/bolt groups albo jawny system mocowania
- Wall handrail:
  - nie generowac slupkow, jezeli handrail jest scienny
  - generowac wall brackets jako connections
  - pokazac diagnostyke, jezeli brak wall/reference plane

### 11. Naprawic polaczenia

- Uzywac generycznych connection components:
  - `standard-hardware` dla tread/support fixings, floor/top fixings, post bases, wall brackets i spiral column brackets
  - `member-splice` dla transport split hardware
- Kazdy connection component ma dostac input:
  - host object ids
  - local frame
  - expected plate face
  - bolt side
  - clearance
  - material/fastener refs
- Kazdy connection component musi tworzyc normalne plates/holePatterns/features/fastenerGroups/welds.
- Zadna sruba nie moze byc generowana bez host patternu lub logicznego reference frame.
- Dla anchor bolts dodac jawny host: floor plate/top slab plate/reference plane.
- Dla rail post base dodac base plate pod kazdym slupkiem.
- Dla tread fixings dodac cleat/bracket pod kazdym stopniem albo zdefiniowany alternate fixing.
- Dla splitow dodac splice plates na obu stronach splitu.

### 12. Naprawic sekcje transportowe

- Sectioning ma dzialac na solved layout, zanim powstana polaczenia splitu.
- Dla max weight:
  - policzyc approx weight members/plates/fasteners
  - wyznaczyc split stations
  - utworzyc assemblies per section
  - utworzyc split connection hardware
- Dla manual stations:
  - zwalidowac, czy station lezy na flight/support, a nie w przypadkowym miejscu
  - jezeli station wypada w zlym miejscu, pokazac diagnostic
- Dla landing strategy:
  - split przy landingach
  - hardware na wejsciach/wyjsciach flightu

### 13. Naprawic Part K i rule packs

- Rule pack UK Part K ma sprawdzac minimum:
  - rise range
  - going range
  - pitch
  - headroom
  - handrail/guarding height
  - gaps/openings where model supports this
  - landing presence/size where applicable
- Diagnostics musza wskazywac:
  - parameter path
  - object role
  - measured value
  - allowed value
  - fix hint
- `stair-system-compliance-failures` ma celowo dostac `health=error`, ale nadal ma byc wizualnie czytelny.
- Inne warianty w macierzy maja miec `health=ok`.

### 14. Uporzadkowac role, nazwy i materialy

- Nazwy obiektow maja byc czytelne:
  - `left_stringer_1`
  - `tread_05_tray`
  - `tread_05_timber`
  - `rail_left_post_03`
  - `base_plate_left_01`
- Role maja byc stabilne po zmianie parametrow.
- Materialy:
  - steel dla supportow i brackets
  - timber dla finish boards
  - glass dla panels
  - fastener refs zgodne z katalogiem
- Kolory/rendering maja pomagac w kontroli:
  - steel ciemny
  - tread surface jasna/drewniana
  - glass transparentny, ale nie tak mocno, zeby znikal
  - fasteners czytelne, ale nie dominujace na full view

### 15. Wdrozyc etapami wedlug benchmarkow

- Etap A: straight-basic
  - doprowadzic do pelnego PASS
  - nie ruszac dalej, jezeli straight-basic wyglada zle

- Etap B: straight-landing, L, U
  - dopiero po PASS z straight-basic
  - skupic sie na landingach, turnach i ciaglosci balustrady

- Etap C: grating, glass, mono
  - rodziny alternatywne
  - sprawdzic, czy top-level layout nie jest sklejony z jednym typem family

- Etap D: winder, curved
  - krzywe walking lines i klinowe/trapezowe treads
  - sprawdzic, czy supporty i railings ida po offset paths

- Etap E: spiral, helical
  - radial/helix layout
  - central column/mono support
  - railing bez losowych skokow

- Etap F: split-weight, manual-split
  - sekcje i splice hardware
  - sprawdzic montowalnosc

- Etap G: compliance-failures
  - tylko po tym, jak geometria bazowa jest stabilna
  - potwierdzic expected diagnostics

### 16. Petla recenzji subagenta

Dla kazdego wariantu:

- Uruchomic generator sample.
- Uruchomic schema validation.
- Otworzyc viewer.
- Zrobic screenshoty.
- Przygotowac `review-request.md`.
- Spawn subagent-reviewer z obrazami jako `local_image` items.
- Przekazac opis intencji wariantu.
- Subagent zwraca `PASS`, `FAIL` albo `NEEDS_MORE_VIEW`.
- Zapisac odpowiedz do `subagent-review.md`.
- Jezeli wynik nie jest `PASS`:
  - dopisac konkretny problem do `summary.md`
  - poprawic generator
  - wygenerowac sample od nowa
  - zrobic nowe screenshoty
  - wyslac znowu do subagenta
- Nie zaliczac wariantu na podstawie wlasnego przekonania bez recenzji.

### 17. Zasady oceny subagenta

Subagent ma byc surowy.

- FAIL, jezeli rail przechodzi przez flight albo landing.
- FAIL, jezeli post jest krzywy bez uzasadnienia.
- FAIL, jezeli stopnie nie wygladaja jak powierzchnie do chodzenia.
- FAIL, jezeli sruby wisza w powietrzu.
- FAIL, jezeli glass panel przecina stopnie albo ma losowy ksztalt.
- FAIL, jezeli base/top fixing nie istnieje w wariancie, ktory ma byc kompletny.
- FAIL, jezeli split nie ma montazowego polaczenia.
- FAIL, jezeli z top/axon/elevation nie da sie zrozumiec, jak schody stoja i jak sa przykrecane.
- NEEDS_MORE_VIEW, jezeli detale sa zasloniete albo zbyt male.

### 18. Finalny raport

Na koncu stworzyc:

```text
artifacts/stair-qa/<run-id>/summary.md
```

Raport ma miec:

- tabela wszystkich wariantow
- linki/sciezki do screenshotow
- status automatycznych checkow
- status geometrii
- status polaczen
- status balustrady
- status sekcji/splitow
- status compliance
- finalny status subagenta
- lista pozostalych ryzyk

Pursue goal konczy sie tylko wtedy, gdy `summary.md` ma finalny status:

```text
ALL STAIR VARIANTS PASS
```

## Minimalny zakres zmian w app core

App core moze dostac tylko te rzeczy, jezeli sa potrzebne i generyczne:

- route/path helpers
- station frames
- sectioning helpers
- weight/schedule helpers
- screenshot QA helper, jezeli jest ogolny dla viewer demos
- generic Smart Component diagnostics UI
- generic nested Smart Component lifecycle fixes
- generic object/role validation helpers

Nie dodawac do core:

- `if stair`
- stale parametry schodow
- stale typy stopni
- stale typy balustrad
- stale polaczenia schodow
- hidden geometry generator dla schodow

## Zakres zmian w generatorze schodow

Tu powinny trafic rzeczy domenowe:

- solver schodow
- route-to-flight layout
- tread shape logic
- support/stringer family logic
- railing family logic
- dobor generycznych connection components
- landing families
- transport section rules
- UK Part K rule pack
- sample warianty
- stair-specific diagnostics

## Kolejnosc pracy przy realnej implementacji

1. Zrobic QA runner i baseline screenshots.
2. Straight-basic doprowadzic do PASS.
3. Ustabilizowac solver i role ids.
4. Naprawic treads/supports/connections/railing dla straight.
5. Dodac recenzje subagenta dla straight-basic.
6. Dopiero potem przejsc do landingow.
7. Naprawic straight-landing, L, U.
8. Dodac recenzje subagenta dla landing variants.
9. Naprawic rodziny grating/glass/mono.
10. Dodac recenzje subagenta dla family variants.
11. Naprawic curved/winder.
12. Dodac recenzje subagenta dla curved/winder.
13. Naprawic spiral/helical.
14. Dodac recenzje subagenta dla spiral/helical.
15. Naprawic split-weight/manual-split.
16. Dodac recenzje subagenta dla split variants.
17. Naprawic compliance failures sample.
18. Dodac finalna recenzje subagenta dla calej macierzy.
19. Uruchomic `node .\scripts\check_repo.js`.
20. Zapisac finalny `summary.md`.
21. Zakonczyc goal tylko, jezeli wszystkie statusy sa PASS.

## Najwazniejsza zasada praktyczna

Nie poprawiac schodow "na oko" tylko w jednym widoku.

Kazda poprawka musi byc oceniona w:

- widoku z gory
- widoku aksonometrycznym
- elewacji
- detalach mocowan, jezeli poprawka dotyczy polaczen

Jezeli model wyglada dobrze tylko w axonometric, ale z gory albo z boku pokazuje przeciecia, wariant jest `FAIL`.
