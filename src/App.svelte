<script>
    import {onMount} from 'svelte';
    import Pusher from 'pusher-js';
		import io from 'socket.io-client'
		//let STRAPI_ENDPOINT = 'http://localhost:1337'
		let STRAPI_ENDPOINT = 'https://code-school.biz:1443'

		var socket = io(STRAPI_ENDPOINT);

    let username = '';
    let message = '';
    let messages = [];

    onMount(() => {
        Pusher.logToConsole = true;

        const pusher = new Pusher('', {
            cluster: ''
        });

        const channel = pusher.subscribe('chat');
        channel.bind('message', data => {
            messages = [...messages, data];
        });
    })

		socket.on('chat message', function(msg) {
			console.log('chat message = ',msg);
			messages = [...messages, msg];
			console.log('messages = ',messages);
			console.log(typeof(msg));
		});


    const submit = async () => {
			console.log("button pressed!")
			socket.emit('join', {message,username});
      message = '';
    }
</script>

<div class="container">
    <div class="d-flex flex-column align-items-stretch flex-shrink-0 bg-white">
        <div class="d-flex align-items-center flex-shrink-0 p-3 link-dark text-decoration-none border-bottom">
            <input class="fs-5 fw-semibold" bind:value={username} placeholder='Enter your name'/>
        </div>
        <div class="list-group list-group-flush border-bottom scrollarea">
            {#each messages as msg}
                <div class="list-group-item list-group-item-action py-3 lh-tight">
                    <div class="d-flex w-100 align-items-center justify-content-between">
                        <strong class="mb-1">{msg.message.username}</strong>
                    </div>
                    <div class="col-10 mb-1 small">{msg.message.message}</div>
                </div>
            {/each}
        </div>
    </div>
    <form id="form" on:submit|preventDefault={submit}>
        <input id="input" class="form-control" placeholder="Write a message" bind:value={message}/><button>Send</button>
    </form>
</div>

<style>
	.scrollarea {
		min-height: 500px;
	}
	#form {
		background: rgba(0, 0, 0, 0.15);
		padding: 0.25rem;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		height: 3rem;
		box-sizing: border-box;
		backdrop-filter: blur(10px);
	}
	#form > button {
		background: #333;
		border: none;
		padding: 0 1rem;
		margin: 0.25rem;
		border-radius: 3px;
		outline: none;
		color: #fff;
	}
	#input {
		border: none;
		padding: 0 1rem;
		flex-grow: 1;
		border-radius: 2rem;
		margin: 0.25rem;
	}
</style>
