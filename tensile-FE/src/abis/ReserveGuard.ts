export const ReserveGuardAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "access_",
        "type": "address",
        "internalType": "contract ITensileAccess"
      },
      {
        "name": "warehouses_",
        "type": "address",
        "internalType": "contract IWarehouseRegistry"
      },
      {
        "name": "passport_",
        "type": "address",
        "internalType": "contract IMaterialPassport"
      },
      {
        "name": "maxStaleness_",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "REASON_BREACH",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
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
    "name": "canAdd",
    "inputs": [
      {
        "name": "warehouseId",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "addKg",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isHealthy",
    "inputs": [
      {
        "name": "warehouseId",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "maxStaleness",
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
    "name": "passport",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IMaterialPassport"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "poke",
    "inputs": [
      {
        "name": "warehouseId",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "healthy",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "reserveOf",
    "inputs": [
      {
        "name": "warehouseId",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "reserveKg",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "fresh",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setMaxStaleness",
    "inputs": [
      {
        "name": "s",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "warehouses",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IWarehouseRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "MaxStalenessSet",
    "inputs": [
      {
        "name": "maxStaleness",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ReserveBreach",
    "inputs": [
      {
        "name": "warehouseId",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "reserveKg",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "outstandingKg",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "stale",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "InvalidStaleness",
    "inputs": []
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
