const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
    alpha3Code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    flag: {
        name: String,
        image: String,
        description: String
    },
    capital: String,
    population: String,
    area: String,
    famousAnimal: {
        name: String,
        image: String,
        description: String
    },
    currency: {
        name: String,
        code: String,
        symbol: String,
        image: String,
        description: String
    }
});

module.exports = mongoose.model('Country', countrySchema); 