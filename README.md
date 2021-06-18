# mydigitalstructure-learn-proxy

Use to set up a domain specific "proxy" api 

## https://learn.mydigitalstructure.cloud/learn-function-automation

Work with AWS API Gateway.

Data format from API Gateway:

{
	"body":
	{
		"apikey": "[user-id]",
		"authkey": "[user-password]",
		"method": "[your domain specific method name]"
	},
	"queryStringParameters": {},
	"headers": {}
}