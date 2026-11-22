import AutocompleteModule from 'react-google-autocomplete';

// Vite 8 (rolldown) with "type": "module" resolves the default import of this CommonJS
// package to its whole `module.exports` ({ default, usePlacesWidget }) instead of the
// component, which crashes React (error #130) in the production build. Unwrap it.
const GoogleAutocomplete = ((AutocompleteModule as unknown as { default?: typeof AutocompleteModule })
  .default ?? AutocompleteModule) as typeof AutocompleteModule;

export default GoogleAutocomplete;
