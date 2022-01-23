# pokemon-api-nodejs

This is a test API that expose a csv file (pokemon.csv) through a JSON RESTful API, listening on port 3000, and allow to read, update, create and delete pokemons. A paginated pokemon catalog is also available.

Compilation
------------

    npm install

Start server
------------

    node main.js

API routes
------------

    /getPokemon/:name

Returns the stats of the pokemon with the specified name.

    /createPokemon
    
Create a new pokemon. The pokemon name must not already exists. The body must contain a JSON object similar like the one returned from /getPokemon
    
    /updatePokemon/:name
    
Updates an existing pokemon. The body must contain a JSON object similar like the one returned from /getPokemon with the values that need to be updated
    
    /deletePokemon/:name
    
Delete an existing pokemon.
    
    /getPokemonCatalog/:page
    
Returns a list of pokemon. Each page (starting at 0) contains up to 50 pokemons.
