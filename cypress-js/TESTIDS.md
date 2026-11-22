# data-testid contract

Every element the E2E suites touch has a `data-testid` in `sut/frontend/src`. Constants live in
`cypress/support/testids.js` (`TID`). Cypress: `cy.tid(id)` / `.tid(id)` (child). Selenium:
`By.cssSelector("[data-testid='<id>']")`. Names are kebab-case `<area>-<element>`; repeated items
(cards, rows) share one id, pick one by index or by text _inside_ the container.

Columns: **C** = used by the Cypress suite, **S** = used by the Selenium suite (replaces id/class/xpath/text locator).

## Shared (TopBar, NotificationSystem, RestaurantCompactCard)

| testid                                                           | element                                                   | C   | S   |
| ---------------------------------------------------------------- | --------------------------------------------------------- | --- | --- |
| `topbar`                                                         | header (replaces `.topbar, header, nav`)                  | x   | x   |
| `topbar-home`                                                    | "DevorApp" home button                                    |     |     |
| `toast-success` / `toast-error` / `toast-info` / `toast-warning` | toast, one per type (`toast-<type>`); several may coexist | x   | x   |
| `confirm-modal`, `confirm-cancel`, `confirm-accept`              | confirm dialog, Cancelar, Confirmar/Eliminar              |     |     |
| `restaurant-card`                                                | compact card (history + favorites lists); repeated        | x   | x   |
| `restaurant-card-open`                                           | button inside the card that opens details (first button)  | x   | x   |
| `restaurant-card-name`                                           | restaurant name in the card                               | x   | x   |

## Side menu

| testid                                      | element                                                                                     | C   | S   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- | --- | --- |
| `side-menu-open`                            | hamburger (was `aria-label='Abrir menú'`)                                                   | x   | x   |
| `side-menu-drawer`, `side-menu-close`       | drawer, close button                                                                        | x   | x   |
| `side-menu-<entry>`                         | `home`, `recommend` (Buscador), `favorites`, `saved` (Para más tarde), `history`, `ratings` | x   | x   |
| `side-menu-profile`, `side-menu-logout`     | user block, Cerrar sesión                                                                   |     |     |
| `side-menu-theme` / `side-menu-fontsize`    | the two toggle groups                                                                       | x   | x   |
| `theme-light`, `theme-dark`                 | Claro / Oscuro (`.active` class = selected)                                                 | x   | x   |
| `font-size-s`, `font-size-m`, `font-size-l` | S / M / L (`.active` class = selected)                                                      | x   | x   |

## Login

`login-form`, `login-identifier`, `login-password`, `login-toggle-password`, `login-forgot`,
`login-submit`, `login-google`, `login-register-link` (replace the ids `login-form`, `identifier`,
`password`, `login-submit-btn`, `google-login-btn`, `go-register-link`; C+S).
`login-message-error` / `login-message-success`: form feedback (was `.message.error`; C+S).
`login-google-error`: Google login error.

## Register

| testid                                                                                                                          | element                                          | C   | S   |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --- | --- |
| `register-step1`                                                                                                                | step 1 container (step 1 is not a `<form>`)      | x   | x   |
| `register-form`                                                                                                                 | form wrapping step 2 only                        | x   | x   |
| `register-step-label`                                                                                                           | "Paso N de 2 ..." paragraph (check its text)     | x   | x   |
| `register-email`, `register-username`, `register-password`, `register-nombre`, `register-apellidos`, `register-toggle-password` | step 1 fields                                    | x   | x   |
| `register-continue`                                                                                                             | Continuar                                        | x   | x   |
| `register-step-error`                                                                                                           | step 1 validation banner                         | x   | x   |
| `register-email-error`, `register-username-error`                                                                               | field errors                                     | x   | x   |
| `register-ubicacion`, `register-gps`, `register-location-name`                                                                  | step 2 location input, GPS button, detected name | x   | x   |
| `register-submit`, `register-back`                                                                                              | step 2 buttons                                   | x   | x   |
| `register-message-error` / `register-message-success`                                                                           | API feedback (`.message.error`)                  | x   | x   |
| `register-verify-title`                                                                                                         | "Verifica tu correo" heading                     | x   | x   |
| `register-login-link`                                                                                                           | link to login                                    |     |     |

## Recommend

| testid                                                                 | element                                                                                  | C   | S   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --- | --- |
| `recommend-form`, `recommend-submit`                                   | form, "Buscar recomendaciones"                                                           | x   | x   |
| `recommend-cuisine-input`                                              | cuisine text input                                                                       | x   | x   |
| `cuisine-option-<tag.id>`                                              | dropdown option, id from `src/data/tags.json` (e.g. `cuisine-option-mexican_restaurant`) | x   | x   |
| `recommend-cuisine-tag`                                                | selected cuisine chip inside the form                                                    |     |     |
| `price-1` .. `price-4`                                                 | price level buttons (1 = first/cheapest, "€")                                            | x   | x   |
| `recommend-include-no-price`, `recommend-open-now`                     | checkbox `<input>`s                                                                      | x   | x   |
| `recommend-location-preferred`, `recommend-location-custom`            | radio `<input>`s                                                                         | x   | x   |
| `recommend-location-input`                                             | "other location" input (only in custom mode)                                             | x   | x   |
| `recommend-preferred-location-name`                                    | text under "Usar ubicación preferida" ("Desconocida" until loaded)                       | x   |     |
| `recommend-error`                                                      | error banner (`.message.error`)                                                          | x   | x   |
| `recommend-chip-tag`, `recommend-chip-price`, `recommend-edit-filters` | collapsed filter chips; "Editar" (was `.chip-edit`)                                      | x   |     |
| `recommend-results-title`, `recommend-results-count`                   | results header                                                                           | x   | x   |
| `recommend-result-card`                                                | suggestion card (was `.suggestion-card`); repeated                                       | x   | x   |
| `recommend-prev-page`, `recommend-next-page`                           | pagination                                                                               |     |     |

## Favorites

| testid                                                                                                    | element                                     | C   | S   |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --- | --- |
| `favorites-loading`, `favorites-detail-loading`                                                           | spinners (list overview / list detail)      | x   | x   |
| `favorites-empty`                                                                                         | "Aún no tienes listas"                      | x   | x   |
| `favorites-list-card`                                                                                     | list card (was `.fav-list-card`); repeated  | x   | x   |
| `favorites-list-open`, `favorites-list-name`                                                              | open button, list name inside the card      | x   | x   |
| `favorites-list-menu`, `favorites-list-rename`, `favorites-list-delete`                                   | list ⋮ menu and entries                     |     |     |
| `favorites-new-list`, `favorites-new-list-name`, `favorites-new-list-submit`, `favorites-icon-<IconName>` | "new list" modal                            |     |     |
| `favorites-detail`                                                                                        | list detail view                            | x   | x   |
| `favorites-detail-empty`                                                                                  | "Esta lista está vacía" / no search results | x   | x   |
| `favorites-search`                                                                                        | search input in detail                      | x   | x   |
| `favorites-card-menu`, `favorites-menu-details`, `favorites-menu-history`, `favorites-menu-delete`        | restaurant ⋮ menu                           |     |     |

Restaurant cards in the detail view are `restaurant-card`.

## History

| testid                                                                                                               | element                                                                       | C   | S   |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --- | --- |
| `history-loading`                                                                                                    | spinner                                                                       | x   | x   |
| `history-search`, `history-filter`                                                                                   | search input, status filter button                                            | x   | x   |
| `history-group-header`, `history-group-title`                                                                        | month group header button / title                                             | x   | x   |
| `history-rating-badge`                                                                                               | "Reseñado" / "Sin reseñar" badge on a card                                    |     |     |
| `history-card-menu`                                                                                                  | ⋮ button of a card (last button of `restaurant-card`)                         | x   | x   |
| `history-menu-details`, `history-menu-rechoose`, `history-menu-favorite`, `history-menu-rate`, `history-menu-delete` | ⋮ menu entries; `history-menu-rate` = "Valorar restaurante" / "Editar reseña" | x   | x   |
| `history-fav-list-option`, `history-fav-new-list-name`, `history-fav-create`                                         | add-to-favorites modal                                                        |     |     |

## Rating modal (opened from history)

| testid                           | element                                           | C   | S   |
| -------------------------------- | ------------------------------------------------- | --- | --- |
| `rating-overlay`, `rating-modal` | full overlay / content (was `.valuation-content`) | x   | x   |
| `rating-back`                    | Volver                                            |     |     |
| `rating-aspect-<aspect>`         | row for `calidad`, `precio`, `higiene`, `trato`   | x   | x   |
| `rating-star-<aspect>-<n>`       | star n = 1..5 of that aspect                      | x   | x   |
| `rating-comment`                 | comment textarea                                  | x   | x   |
| `rating-submit`                  | submit button (disabled until all aspects > 0)    | x   | x   |

Success toast after submit: `toast-success`.

## Profile

| testid                                                                  | element                                                        | C   | S   |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- | --- | --- |
| `profile-header-name`, `profile-header-email`                           | name / email in the page header                                | x   | x   |
| `profile-card-personal`, `-location`, `-email`, `-security`, `-danger`  | the five `.location-info-card`s                                | x   | x   |
| `profile-personal-edit` / `-save` / `-cancel`                           | Editar / Guardar cambios / Cancelar                            | x   | x   |
| `profile-personal-nombre`, `profile-personal-apellidos`                 | inputs                                                         | x   | x   |
| `profile-location-edit` / `-save` / `-cancel`, `profile-location-input` | Cambiar / Guardar cambios / Cancelar, input                    | x   | x   |
| `profile-email-edit` / `-submit` / `-cancel`                            | Cambiar / Cambiar correo / Cancelar                            | x   | x   |
| `profile-email-input`, `profile-email-password`                         | new email, current password                                    | x   | x   |
| `profile-security-edit` / `-submit` / `-cancel`                         | Cambiar contraseña / Actualizar contraseña / Cancelar          | x   | x   |
| `profile-security-current`, `-new`, `-confirm`                          | password inputs                                                | x   | x   |
| `profile-danger-open`                                                   | Eliminar cuenta permanentemente                                | x   | x   |
| `profile-danger-confirm-input`                                          | type CONFIRMAR                                                 | x   | x   |
| `profile-danger-submit`, `profile-danger-cancel`                        | Eliminar permanentemente (disabled until confirmed) / Cancelar | x   | x   |

## Selenium-only notes

Selenium uses the same ids; nothing exists only for it. Still not testid-able: `<html data-theme>` /
`data-font-size` attributes (read from the `html` tag) and the `active` class on theme/font buttons.
