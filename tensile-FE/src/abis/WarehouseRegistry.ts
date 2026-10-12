export const WarehouseRegistryAbi = [
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
    "name": "exists",
    "inputs": [
      {
        "name": "id",
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
    "name": "freeze",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "reason",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getWarehouse",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IWarehouseRegistry.Warehouse",
        "components": [
          {
            "name": "operator",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "regionCode",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "reserveFeed",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "active",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "frozen",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "metaURI",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isActive",
    "inputs": [
      {
        "name": "id",
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
    "name": "isFrozen",
    "inputs": [
      {
        "name": "id",
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
    "name": "operatorOf",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "regionOf",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
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
    "name": "registerWarehouse",
    "inputs": [
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "regionCode",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "metaURI",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "reserveFeedOf",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setActive",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "active",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMetaURI",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "metaURI",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setOperator",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setReserveFeed",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "feed",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "unfreeze",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "warehouseCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "ActiveSet",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "active",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MetaURISet",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "metaURI",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OperatorSet",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "operator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ReserveFeedSet",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "feed",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WarehouseFrozen",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "reason",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "by",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WarehouseRegistered",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "operator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "regionCode",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "metaURI",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WarehouseUnfrozen",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "InvalidRegion",
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
    "name": "UnknownWarehouse",
    "inputs": [
      {
        "name": "id",
        "type": "uint32",
        "internalType": "uint32"
      }
    ]
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
