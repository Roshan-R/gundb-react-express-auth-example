import React, { useState, useEffect, useRef } from 'react';
import Gun from 'gun/gun';
import 'gun/sea';

import Login from './Login';
import UserInfo from './UserInfo';
import useSessionChannel from './useSessionChannel';

const App = () => {
  const gunRef = useRef();
  const userRef = useRef();
  const certificateRef = useRef();
  const sessionChannel = useSessionChannel({ userRef });
  const [userProfile, setUserProfile] = useState();

  useEffect(() => {
    const gun = Gun(['http://localhost:8765/gun']);

    // create user
    const user = gun
      .user()
      // save user creds in session storage
      // this appears to be the only type of storage supported.
      // use broadcast channels to sync between tabs
      .recall({ sessionStorage: true });

    gun.on('auth', () => {
      // notify other tabs
      sessionChannel.postMessage({
        eventName: 'I_HAVE_CREDS',
        value: window.sessionStorage.getItem('pair'),
      });

      user.get('alias').once((username) => {
        // get new certificate
        fetch('http://localhost:8765/api/certificates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            pub: user.is.pub,
          }),
        })
          .then((resp) => resp.json())
          .then(({ certificate }) => {
            // store certificate in app memory
            // TODO check if expiry isn't working or misconfigured
            // TODO handle expired certificates
            certificateRef.current = certificate;
          });

        setUserProfile((p) => ({
          ...p,
          username,
        }));
      });
    });

    sessionChannel.onMessage((e) => {
      const { eventName } = e.data;

      console.log(eventName);

      if (eventName === 'REMOVE_YOUR_CREDS') {
        logOut();
      }
    });

    gunRef.current = gun;
    userRef.current = user;
  }, []);

  const logOut = (evt) => {
    certificateRef.current = null;

    userRef.current.leave();

    // check if logout failed, if so manually remove
    // user from session storage
    // see https://gun.eco/docs/User#user-leave
    if (userRef.current._.sea) {
      window.sessionStorage.removeItem('pair');
    }

    // logged out from click, notify other tabs
    if (evt) {
      sessionChannel.postMessage({
        eventName: 'REMOVE_YOUR_CREDS',
      });
    }

    setUserProfile();
  };

  return (
    <div>
      {!userProfile && (
        <div>
          <Login gunRef={gunRef} userRef={userRef} />
        </div>
      )}
      {userProfile && (
        <div>
          <h1>community</h1>
          <div>
            logged in as {userProfile.username}.{' '}
            <button onClick={logOut}>Log out</button>
          </div>
          <h2>your info</h2>
          <div>
            <UserInfo
              gunRef={gunRef}
              userRef={userRef}
              certificateRef={certificateRef}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
