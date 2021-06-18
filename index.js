/*
	PROXY API;

	Depends on;
	https://learn.mydigitalstructure.cloud/learn-function-automation

	---

	This is a lambda compliant node app with a wrapper to process data from API Gateway & respond to it.

	To run it on your local computer your need to install
	https://www.npmjs.com/package/lambda-local and then run as:

	lambda-local -l index.js -t 9000 -e event.json

	API Gateway docs:
	- https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
	
	Event Data:
	{
	  "body": {
	    "apikey": "e7849d3a-d8a3-49c7-8b27-70b85047e0f1"
	  },
	  "queryStringParameters": {},
	  "headers": {}
	}

	!AUTH
	Get apikey in the event data, and using user in settings.json get the username based on matching GUID
	The use the authKey in the event data as the password with the username.
	!! In production make sure the settings.json is unrestricted data with functional restriction to setup_user
	!!! The apiKey user has restricted data (based on relationships) and functional access

	Run;
	lambda-local -l index.1991-1.0.1.js -t 9000 -e event.json
*/

exports.handler = function (event, context, callback)
{
	var mydigitalstructure = require('mydigitalstructure')
	var _ = require('lodash')
	var moment = require('moment');

	mydigitalstructure.set(
	{
		scope: 'app',
		context: 'event',
		value: event
	});

	mydigitalstructure.set(
	{
		scope: 'app',
		context: 'context',
		value: context
	});

	/*
		Use promise to responded to API Gateway once all the processing has been completed.
	*/

	const promise = new Promise(function(resolve, reject)
	{	
		mydigitalstructure.init(main)

		function main(err, data)
		{
			/*
				app initialises with mydigitalstructure.invoke('app-init') after controllers added.
			*/

			mydigitalstructure.add(
			{
				name: 'app-init',
				code: function ()
				{
					mydigitalstructure._util.message('Using mydigitalstructure module version ' + mydigitalstructure.VERSION);
					mydigitalstructure._util.message(mydigitalstructure.data.session);

					var eventData = mydigitalstructure.get(
					{
						scope: 'app',
						context: 'event'
					});

					var request =
					{ 
						body: {},
						queryString: {},
						headers: {}
					}

					if (eventData != undefined)
					{
						request.queryString = eventData.queryStringParameters;
						request.headers = eventData.headers;

						if (_.isString(eventData.body))
						{
							request.body = JSON.parse(eventData.body)
						}
						else
						{
							request.body = eventData.body;
						}	
					}

					mydigitalstructure.set(
					{
						scope: 'app',
						context: 'request',
						value: request
					});

					mydigitalstructure.invoke('app-auth');
				}
			});

			mydigitalstructure.add(
			{
				name: 'app-auth',
				code: function (param)
				{
					var request = mydigitalstructure.get(
					{
						scope: 'app',
						context: 'request'
					});

					var requestApiKeyGUID = request.body.apikey;

					mydigitalstructure.cloud.search(
					{
						object: 'setup_user',
						fields: [{name: 'username'}],
						filters:
						[
							{
								field: 'guid',
								comparison: 'EQUAL_TO',
								value: requestApiKeyGUID
							}
						],
						callback: 'app-auth-process'
					});
				}
			});

			mydigitalstructure.add(
			{
				name: 'app-auth-process',
				code: function (param, response)
				{
					console.log(response)

					mydigitalstructure.set(
					{
						scope: 'app',
						context: 'user',
						value: response
					});

					if (response.status == 'ER')
					{
						mydigitalstructure.invoke('util-end', {error: 'Error processing user authentication.'}, '401');
					}
					else
					{
						if (response.data.rows.length == 0)
						{
							var request = mydigitalstructure.get(
							{
								scope: 'app',
								context: 'request'
							});

							var requestApiKeyGUID = request.body.apikey;

							mydigitalstructure.invoke('util-end', {error: 'Bad apikey [' + requestApiKeyGUID + ']'}, '401');
						}
						else
						{
							var user = _.first(response.data.rows);

							var request = mydigitalstructure.get(
							{
								scope: 'app',
								context: 'request'
							});

							var requestAuthKeyGUID = request.body.authkey;

							mydigitalstructure.logon('app-auth-logon-process',
							{
								logon: user.username,
								password: requestAuthKeyGUID
							});
						}
					}
				}
			});

			mydigitalstructure.add(
			{
				name: 'app-auth-logon-process',
				code: function (response)
				{
					if (response.status == 'ER')
					{
						mydigitalstructure.invoke('util-end', {error: 'Bad authkey [' + requestAuthKeyGUID + ']'}, '401');
					}
					else
					{
						console.log(response);

						mydigitalstructure.set(
						{
							scope: 'app',
							context: 'user',
							value: response
						});

						mydigitalstructure.invoke('app-user');
					}
				}
			});

			mydigitalstructure.add(
			{
				name: 'app-user',
				code: function (param)
				{
					mydigitalstructure.cloud.invoke(
					{
						method: 'core_get_user_details',
						callback: 'app-user-process'
					});
				}
			});

			mydigitalstructure.add(
			{
				name: 'app-user-process',
				code: function (param, response)
				{
					console.log(response)

					mydigitalstructure.set(
					{
						scope: 'app',
						context: 'user',
						value: response
					})

					mydigitalstructure.invoke('app-start')
				}
			});

			mydigitalstructure.add(
			{
				name: 'util-uuid',
				code: function (param)
				{
					var pattern = mydigitalstructure._util.param.get(param, 'pattern', {"default": 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'}).value;
					var scope = mydigitalstructure._util.param.get(param, 'scope').value;
					var context = mydigitalstructure._util.param.get(param, 'context').value;

					var uuid = pattern.replace(/[xy]/g, function(c) {
						    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
						    return v.toString(16);
						  });

					mydigitalstructure.set(
					{
						scope: scope,
						context: context,
						value: uuid
					})
				}
			});

			mydigitalstructure.add(
			{
				name: 'app-log',
				code: function ()
				{
					var eventData = mydigitalstructure.get(
					{
						scope: 'app',
						context: 'event'
					});

					mydigitalstructure.cloud.invoke(
					{
						object: 'core_debug_log',
						fields:
						{
							data: JSON.stringify(eventData),
							notes: 'app Log (Event)'
						}
					});

					var requestData = mydigitalstructure.get(
					{
						scope: 'app',
						context: 'request'
					});

					mydigitalstructure.cloud.invoke(
					{
						object: 'core_debug_log',
						fields:
						{
							data: JSON.stringify(requestData),
							notes: 'app Log (Request)'
						}
					});

					var contextData = mydigitalstructure.get(
					{
						scope: 'app',
						context: 'context'
					});

					mydigitalstructure.cloud.invoke(
					{
						object: 'core_debug_log',
						fields:
						{
							data: JSON.stringify(contextData),
							notes: 'appLog (Context)'
						},
						callback: 'app-log-saved'
					});
				}
			});

			mydigitalstructure.add(
			{
				name: 'app-log-saved',
				code: function (param, response)
				{
					mydigitalstructure._util.message('Log data saved to mydigitalstructure.cloud');
					mydigitalstructure._util.message(param);
					mydigitalstructure._util.message(response);
				
					mydigitalstructure.invoke('app-respond')
				}
			});

			mydigitalstructure.add(
			{
				name: 'app-respond',
				code: function (param)
				{
					var response = mydigitalstructure.get(
					{
						scope: 'app',
						context: 'response'
					});

					var statusCode = response.httpStatus;
					if (statusCode == undefined) {statusCode = '200'}

					var body = response.data;
					if (body == undefined) {body = {}}

					var headers = response.headers;
					if (headers == undefined) {headers = {}}

					let httpResponse =
					{
						statusCode: statusCode,
						headers: headers,
						body: JSON.stringify(body)
					};

					resolve(httpResponse)
				}
			});

			mydigitalstructure.add(
			{
				name: 'util-end',
				code: function (data, statusCode)
				{
					if (statusCode == undefined) { statusCode: '200' }

					mydigitalstructure.set(
					{
						scope: 'app',
						context: 'response',
						value: {data: data, statusCode: statusCode}
					});

					mydigitalstructure.invoke('app-respond')
				}
			});

			mydigitalstructure.add(
			{
				name: 'app-start',
				code: function ()
				{
					var request = mydigitalstructure.get(
					{
						scope: 'app',
						context: 'request'
					});

					var data = request.body;
					var mode = data.mode;
					var method = data.method;

					if (_.isString(mode))
					{
						mode = {type: mode, status: 'OK'}
					}

					if (mode == undefined)
					{
						mode = {type: 'live', status: 'OK'}
					}

					if (mode.status == undefined)
					{
						mode.status = 'OK';
					}

					mode.status = mode.status.toUpperCase();

					if (mode.type == 'reflect')
					{
						var response = {}

						if (mode.data != undefined)
						{
							response.data = mode.data;
						}
						
						mydigitalstructure.invoke('util-uuid',
						{
							scope: 'guid',
							context: 'log'
						});

						mydigitalstructure.invoke('util-uuid',
						{
							scope: 'guid',
							context: 'audit'
						});

						response.data = _.assign(response.data,
						{
							status: mode.status,
							method: method,
							reflected: data,
							guids: mydigitalstructure.get(
							{
								scope: 'guid'
							})
						});

						mydigitalstructure.set(
						{
							scope: 'app',
							context: 'response',
							value: response
						});

						mydigitalstructure.invoke('app-respond');
					}
					else
					{
						mydigitalstructure.invoke('app-process');
					}
				}
			});

			mydigitalstructure.add(
			{
				name: 'app-process',
				code: function ()
				{
					var request = mydigitalstructure.get(
					{
						scope: 'app',
						context: 'request'
					});

					var data = request.body;
					var method = data.method;
	
					if (method == '[your-method]')
					{
						mydigitalstructure.invoke('app-process-' + method)
					}
					else
					{
						mydigitalstructure.set(
						{
							scope: 'app',
							context: 'response',
							value:
							{
								status: 'ER',
								data: {error: {code: '2', description: 'Not a valid method [' + method + ']'}}
							}
						});

						mydigitalstructure.invoke('app-respond');
					}
				}
			});

			mydigitalstructure.add(
			{
				name: 'app-process-[your-method]',
				code: function ()
				{
					var request = mydigitalstructure.get(
					{
						scope: 'app',
						context: 'request'
					});

					var data = request.body.data;

					if (data == undefined)
					{
						mydigitalstructure.invoke('util-end', 
						{
							error: 'Missing data.'
						},
						'403');
					}
					else
					{
						//Example call to mydigitalstructure

						var filters = [];

						if (data.firstname != '')
						{
							filters = _.concat(filters,
							[
								{
									field: 'firstname',
									comparison: 'EQUAL_TO',
									value: encodeURIComponent(data.firstname)
								}
							]);
						}

						var suppliers = mydigitalstructure.cloud.search(
						{
							object: 'contact_person',
							fields:
							[
								{name: 'firstname'},
								{name: 'surname'},
								{name: 'guid'},
								{name: 'etag'},
								{name: 'modifieddate'}
							],
							filters: filters,
							sorts:
							[
								{
									name: 'firstname', 
									direction: 'asc'
								}
							],
							rows: 99999,
							callback: 'app-process-[your-method]-response'
						});
					}
				}
			});

			mydigitalstructure.add(
			{
				name: 'app-process-[your-method]-response',
				code: function (param, response)
				{
					if (response.status == 'ER')
					{
						mydigitalstructure.invoke('util-end', {error: 'Can not process request.'}, '500');
					}
					else
					{
						var data = [];

						_.each(response.data.rows, function (row)
						{
							data.push(
							{
								firstname: mydigitalstructure._util.clean(row['firstname']),
								lastname: mydigitalstructure._util.clean(row['surname']),
								guid: row['guid'],
								etag: row['etag'],
								modifieddatetime: row['modifieddate']
							})
						});

						mydigitalstructure.invoke('util-end',
						{
							method: '[your-method]',
							status: 'OK',
							data: data
						},
						'200');
					}
				}
			});
			
			// !!!! APP STARTS HERE; Initialise the app; app-init invokes app-start if authentication OK
			mydigitalstructure.invoke('app-init');
		}		
   });

  	return promise
}