/* globals UI */

var C = UI.Views.Connector;

class EditForm extends C.View {
  constructor(props) {
    super(props);
    this.state = {
      events: []
    };
    if (!props.connector) {
      this.state.mode = 'connect';
    }
  }
  render() {
    return (
      <C.Page default="setup" {...this.props}>
        <C.Panel name="Setup" slug="setup">
          <C.Column type="notes">
            <h1>Adding a Salesforce Connector</h1>
            <ol>
              <li>Log in to <a href="https://login.salesforce.com/">https://login.salesforce.com/</a></li>
              <li>Click <strong>'&lt;name&gt;'</strong>.</li>
              <li>Click <strong>'My Settings'</strong>.</li>
              <li>Click <strong>'Personal'</strong>.</li>
              <li>Click <strong>'Reset My Security Token'</strong>.</li>
              <li>Click <strong>'Reset Security Token'</strong>.</li>
              <li>Go to your email and get the Security Token.</li>
              <li>Enter your <strong>'Username'</strong> and <strong>'Password'</strong> into the boxes on this page.</li>
              <li>Add the Security Token to the end of your password.</li>
              <li>Click <strong>'Save & Verify'</strong>.</li>
            </ol>
          </C.Column>
          <C.Column>
            <form onChange={(evt) => {
              this.props.updateField(evt);
            }} onSubmit={(evt) => {
              this.props.updateSettings(evt);
            }}>
              <UI.FormElements.Input inactive={!!(this.props.connectorInstance)} placeholder="Key" name="key" label="Key" type="text" value={this.props._key}/>
              <UI.FormElements.Input placeholder="Username" name="username" label="Username" type="text" value={this.props.settings.username}/>
              <UI.FormElements.Input placeholder="Password" name="password" label="Password" type="text" value={this.props.settings.password}/>
              <UI.FormElements.Button
                loading={this.props.saving}
                text={this.props.connectorInstance ? 'Save' : 'Create'}
                type="large"
                submit={true}
                onClick={this.props.updateSettings} />
            </form>
          </C.Column>
        </C.Panel>
      </C.Page>
    );
  }
}

export default EditForm;
global.EditForm = EditForm;
