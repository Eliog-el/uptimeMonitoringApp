/**
 * Create and export configuration variable
 */

// Container fr all the enviroment

var enviroments = {};

// Staging (default) environment
enviroments.staging = {
  'httpPort': 3000,
  'httpsPort': 3001,
  'envName': "staging",
  'hashingSecret': 'thisIsASecret',
  'maxChecks': '5'
};

// Production enviroment
enviroments.production = {
  'httpPort': 5000,
  'httpsPort': 5001,
  'envName': 'production',
  'hashingSecret': 'thisIsASecret',
  'maxChecks': '5'
};


// Determine which enviroment was passed as a command-line argument
var currentEnviroment = typeof (process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : ''

// Check that the current environment is one of the environment above, if not default to staging
var enviromentToExport = typeof (enviroments[currentEnviroment]) == 'object' ? enviroments[currentEnviroment] : enviroments.staging

// Export the moddule
module.exports = enviromentToExport