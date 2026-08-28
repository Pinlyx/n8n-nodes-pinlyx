import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CrmSolidApi implements ICredentialType {
	name = 'crmSolidApi';

	displayName = 'CRM Solid API';

	documentationUrl = 'https://docs.crmsolid.com';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Create one in CRM Solid under Settings, Developers. Keys start with csk_live_ or csk_test_ and carry the scopes you granted them, so a key that cannot write contacts will fail those operations with 403.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.crmsolid.com',
			description: 'Change this only for a staging or self-hosted deployment',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// Cheapest authenticated call there is: it returns the account behind the key.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/me',
		},
	};
}
