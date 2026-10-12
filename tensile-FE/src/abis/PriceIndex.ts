export const PriceIndexAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "access_",
        "type": "address",
        "internalType": "contract ITensileAccess"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "access",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ITensileAccess"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "minQuantityKg",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "record",
    "inputs": [
      {
        "name": "materialCode",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "regionCode",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "pricePerTonne",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "quantityKg",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMinQuantityKg",
    "inputs": [
      {
        "name": "q",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "statsOf",
    "inputs": [
      {
        "name": "materialCode",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "regionCode",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct PriceIndex.Stats",
        "components": [
          {
            "name": "lastPrice",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lastQuantityKg",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lastAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "trades",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "cumQuantityKg",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "cumNotional",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "vwap",
    "inputs": [
      {
        "name": "materialCode",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "regionCode",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "MinQuantitySet",
    "inputs": [
      {
        "name": "minQuantityKg",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TradeIgnored",
    "inputs": [
      {
        "name": "materialCode",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "regionCode",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "quantityKg",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TradeRecorded",
    "inputs": [
      {
        "name": "materialCode",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "regionCode",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "pricePerTonne",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "quantityKg",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "Unauthorized",
    "inputs": [
      {
        "name": "caller",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
