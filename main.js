const express = require('express');
const fs = require('fs');
const path = require('path');

const ENTRIES_PER_PAGE = 50;
const STATUS_SUCCESS = 200;
const STATUS_SUCCES_NO_DATA = 204;
const STATUS_BAD_REQUEST = 400;
const STATUS_NOT_FOUND = 404;
const STATUS_CONFLICT = 409;

const filePath = process.cwd();
const fileName = 'pokemon.csv';
const port = 3000;
const app = express();

const columns = {
	'#': {formatFct: toInt, validationFct: (value) => validateInt(value, {min: 1}), invalidMsg: 'Attribute \'#\' must be an integer, greater than 1 and must not be null.'},
	Name: {validationFct: (value) => validateString(value, {maxLength: 45}), invalidMsg: 'Attribute \'Name\' must be a string of maximum 45 characters and must not be null or empty.'},
	'Type 1': {validationFct: (value) => validateString(value, {maxLength: 20}), invalidMsg: 'Attribute \'Type 1\' must be a string of maximum 20 characters and must not be null or empty.'},
	'Type 2': {validationFct: (value) => validateString(value, {maxLength: 20, allowNull: true}), invalidMsg: 'Attribute \'Type 2\' must be a string of maximum 20 characters.'},
	Total: {formatFct: toInt, validationFct: (value) => validateInt(value, {min: 1}), invalidMsg: 'Attribute \'Total\' must be an integer, greater than 0 and must not be null.'},
	HP: {formatFct: toInt, validationFct: (value) => validateInt(value, {min: 1}), invalidMsg: 'Attribute \'HP\' must be an integer, greater than 0 and must not be null.'},
	Attack: {formatFct: toInt, validationFct: (value) => validateInt(value, {min: 1}), invalidMsg: 'Attribute \'Attack\' must be an integer, greater than 0 and must not be null.'},
	Defense: {formatFct: toInt, validationFct: (value) => validateInt(value, {min: 1}), invalidMsg: 'Attribute \'Defense\' must be an integer, greater than 0 and must not be null.'},
	'Sp. Atk': {formatFct: toInt, validationFct: (value) => validateInt(value, {min: 1}), invalidMsg: 'Attribute \'Sp. Atk\' must be an integer, greater than 0 and must not be null.'},
	'Sp. Def': {formatFct: toInt, validationFct: (value) => validateInt(value, {min: 1}), invalidMsg: 'Attribute \'Sp. Def\' must be an integer, greater than 0 and must not be null.'},
	Speed: {formatFct: toInt, validationFct: (value) => validateInt(value, {min: 1}), invalidMsg: 'Attribute \'Speed\' must be an integer, greater than 0 and must not be null.'},
	Generation: {formatFct: toInt, validationFct: (value) => validateInt(value, {min: 1}), invalidMsg: 'Attribute \'Generation\' must be an integer, greater than 0 and must not be null.'},
	Legendary: {validationFct: (value) => validateBool(value), invalidMsg: 'Attribute \'Legendary\' must be a boolean and must not be null.'},
};
const keys = Object.keys(columns);
const pokemonsMap = {};
let dataNeedSorting = false;
let pokemonsList = [];

parseFile(process.cwd(), fileName);

app.use(express.json());
app.get('/getPokemon/:name', getPokemon);
app.get('/getPokemonCatalog/:page', getPokemonCatalog);
app.post('/createPokemon', createPokemon);
app.put('/updatePokemon/:name', updatePokemon);
app.delete('/deletePokemon/:name', deletePokemon);

const server = app.listen(port, function () {
   console.log(`API listening at http://127.0.0.1:${server.address().port}`);
});

function parseFile() {
	let fileContent = fs.readFileSync(path.join(filePath, fileName)).toString();
	let lines = fileContent.split('\n');
	for (let i = 1; i < lines.length; i++) {
		let entry = {};
		let values = lines[i].split(',');
		if (values.length < keys.length) continue;
		for (let j = 0; j < keys.length; j++) {
			if (j === keys.length - 1) {
				entry[keys[j]] = values[j] === 'True' || values[j] === 'true' ? true : false;
			}
			else if (j >= 1 && j <= 3) {
				entry[keys[j]] = values[j] !== '' ? values[j] : null;
			}
			else entry[keys[j]] = toInt(values[j]);
		}
		pokemonsMap[entry.Name] = entry;
		pokemonsList = convertMapToSortedList(pokemonsMap);
	}
}

function saveCsvFile() {
	dataNeedSorting = true;
	let fileContent = `${keys.join(',')}`;
	Object.keys(pokemonsMap).forEach((key) => {
		let pokemon = pokemonsMap[key];
		let valuesList = [];
		for (let key of keys) {
			valuesList.push(pokemon[key] != null ? pokemon[key] : '');
		}
		fileContent += `\n${valuesList.join(',')}`;
	});
	fs.writeFileSync(path.join(filePath, fileName), fileContent);
}

function getPokemon(req, res) {
	if (pokemonsMap[req.params.name] == null) res.status(STATUS_NOT_FOUND).send('Pokemon not found.');
	else res.status(STATUS_SUCCESS).send(JSON.stringify(pokemonsMap[req.params.name]));
}

function deletePokemon(req, res) {
	if (pokemonsMap[req.params.name] == null) res.status(STATUS_NOT_FOUND).send('Pokemon not found.');
	else {
		delete pokemonsMap[req.params.name];
		res.sendStatus(STATUS_SUCCES_NO_DATA);
		saveCsvFile();
	}
}

function updatePokemon(req, res) {
	if (pokemonsMap[req.params.name] == null) res.status(STATUS_NOT_FOUND).send('Pokemon not found.');
	else {
		let validationResult = validateDataForUpdate(req.body);
		if (validationResult.result) {
			let entry = pokemonsMap[req.params.name];
			if (req.body.Name != null) {
				if (req.params.name !== req.body.Name && pokemonsMap[req.body.Name] != null) {
					res.status(STATUS_CONFLICT).send('A pokemon with the new entered name already exists.');
					return;
				}
				pokemonsMap[req.body.Name] = entry;
				entry = pokemonsMap[req.body.Name];
				delete pokemonsMap[req.params.name];
			}
			updateEntryData(entry, req.body);
			res.sendStatus(STATUS_SUCCES_NO_DATA);
			saveCsvFile();
		}
		else {
			res.status(STATUS_BAD_REQUEST).send(validationResult.message);
		}
	}
}

function createPokemon(req, res) {
	let validationResult = validateDataForCreate(req.body);
	if (validationResult.result) {
		if (pokemonsMap[req.body.Name] != null) {
			res.status(STATUS_CONFLICT).send('A pokemon with that name already exists.');
			return;
		}
		let entry = {};
		updateEntryData(entry, req.body);
		pokemonsMap[req.body.Name] = entry;
		res.sendStatus(STATUS_SUCCES_NO_DATA);
		saveCsvFile();
	}
	else {
		res.status(STATUS_BAD_REQUEST).send(validationResult.message);
	}
}

function getPokemonCatalog(req, res) {
	let page = toInt(req.params.page);
	if (page != null || page < 0) {
		if (dataNeedSorting) {
			pokemonsList = convertMapToSortedList(pokemonsMap);
		}
		let firstIndex = page * ENTRIES_PER_PAGE;
		let lastIndex = (page + 1) * ENTRIES_PER_PAGE;
		res.status(STATUS_SUCCESS).send(JSON.stringify(pokemonsList.slice(firstIndex, lastIndex)));
	}
	else res.status(STATUS_BAD_REQUEST).send('A page number is required in the request URI. The page number must be a positive integer.');
}

function convertMapToSortedList(map) {
	let list = [];
	Object.keys(map).forEach((key) => {
		list.push(map[key]);
	});
	list.sort((a, b) => {
		if (a['#'] < b['#']) return -1;
		else if (a['#'] > b['#']) return 1;
		else {
			if (a.Name < b.Name) return -1;
			else if (a.Name > b.Name) return 1;
			else return 0;
		}
	});
	dataNeedSorting = false;
	return list;
}

function updateEntryData(entry, data) {
	Object.keys(data).forEach((key) => {
		if (columns[key] != null) {
			if (columns[key].formatFct != null) entry[key] = columns[key].formatFct(data[key]);
			else entry[key] = data[key];
		}
	});
}

function validateDataForCreate(data) {
	let result = true;
	let message = [];
	Object.keys(columns).forEach((key) => {
		if (!columns[key].validationFct(data[key])) {
			result = false;
			message.push(columns[key].invalidMsg);
		}
	});
	return {result: result, message: message.join('\n')};
}

function validateDataForUpdate(data) {
	let usableFields = 0;
	let message = [];
	let result = true;
	Object.keys(data).forEach((key) => {
		if (columns[key] != null) {
			usableFields++;
			if (!columns[key].validationFct(data[key])) {
				result = false;
				message.push(columns[key].invalidMsg);
			}
		}
	});
	if (usableFields <= 0) {
		result = false;
		message.push(`updatePokemon request body must contain at least 1 of the following fields: \'${keys.join(`', '`)}\'.`);
	}
	return {result: result, message: message.join('\n')};
}

function validateString(value, params) {
	if (params === undefined) params = {};
	if (params.allowNull === undefined) params.allowNull = false;
	if (params.maxLength === undefined) params.maxLength = 0;

	if (params.allowNull && (value == null || value == '')) return true;
	else if (!params.allowNull && (value == null || value == '')) return false;
	if (typeof value !== 'string') return false;
	if (params.maxLength > 0 && value.length > params.maxLength) return false;
	return true;
}

function validateInt(value, params) {
	if (params === undefined) params = {};
	if (params.allowNull === undefined) params.allowNull = false;
	if (params.min === undefined) params.min = null;
	if (params.max === undefined) params.max = null;

	if (value == null && params.allowNull) return true;
	else if (value == null && !params.allowNull) return false;
	if (typeof value !== 'number') return false;
	if (params.min != null && value < params.min) return false;
	if (params.max != null && value > params.max) return false;
	return true;
}

function validateBool(value, params) {
	if (params === undefined) params = {};
	if (params.allowNull === undefined) params.allowNull = false;

	if (value == null && params.allowNull) return true;
	else if (value == null && !params.allowNull) return false;
	if (typeof value !== 'boolean') return false;
	return true;
}

function toInt(value) {
	if (typeof(value) === 'number') {
		let result = parseInt(value.toFixed(0));
		return isNaN(result) ? null : result;
	}
	try {
		let result = parseInt(value);
		return isNaN(result) ? null : result;
	}
	catch(e) {
		return null;
	}
}