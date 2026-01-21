#!/bin/bash
cd /home/kavia/workspace/code-generation/react-basic-calculator-203236-203245/calculator_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

