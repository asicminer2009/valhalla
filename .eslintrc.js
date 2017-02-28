module.exports = {
    "extends": "standard",
    "plugins": [
        "standard",
        "promise",
        "react"
    ],
    "rules": {
      "react/jsx-uses-react": 1,
      "react/jsx-uses-vars": 1
    },
    "globals": {
      "atom": false
    },
    "env": {
      "browser": true,
      "node": true
    }
};
