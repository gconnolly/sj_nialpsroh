/* globals process */
'use strict'

const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const twitterParse = require('twitter-url-parser')
const twitterAPI = require('node-twitter-api')
const twitter = new twitterAPI({
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callback: process.env.TWITTER_OAUTH_CALLBACK || 'http://localhost:8080/oauth'
})

const redis = require('redis')
const client = redis.createClient(process.env.REDIS_URL)

const bigInt = require('big-integer')

client.on('error', (error) => {
  console.log(error)
})

app.use(bodyParser.json())

app.post('/', (req, res) => {
  const twitterId = twitterParse(req.body.link).id
  client.get('access', (error, access) => {
    if (error) {
      console.log(error)
    } else if (access) {
      console.log('t: ' + access.token)
      console.log('ts: ' + access.tokenSecret)
      twitter.search(
        {
          q: req.body.text,
          max_id: bigInt(twitterId).minus(1).toString()
        },
        access.token,
        access.tokenSecret,
        (error, data, response) => {
          if (error) {
            console.log(error)
          }
          else if (data && data.statuses && data.statuses[0]) {
            twitter.statuses(
              'update',
              {
                status: 'ney ' + data.statuses[0].id_str // '@horse_js @' + data.statuses[0].user.screen_name + ' https://twitter.com/' + data.statuses[0].user.screen_name + '/status/' + data.statuses[0].id_str,
              // in_reply_to_status_id: twitterId
              },
              access.token,
              access.tokenSecret,
              (error, data, response) => {
                if (error) {
                  console.log(error)
                }
              }
            )
          }
        })
    }
  })
  res.end()
})

app.get('/authenticate', (req, res) => {
  twitter.getRequestToken((error, requestToken, requestTokenSecret, results) => {
    if (error) {
      console.log('Error getting OAuth request token : ' + error)
    } else {
      client.HMSET('request', { token: requestToken, tokenSecret: requestTokenSecret }, (error, result) => {
        if (error) {
          console.log(error)
        } else {
          res.redirect(twitter.getAuthUrl(requestToken))
        }
      })

    }
  })
})

app.get('/oauth', (req, res) => {
  client.get('request', (error, request) => {
    if (error) {
      console.log(error)
    } else if (request) {
      console.log('t: ' + request.token)
      console.log('ts: ' + request.tokenSecret)
      twitter.getAccessToken(
        request.token,
        request.tokenSecret,
        req.query.oauth_verifier,
        (error, accessToken, accessTokenSecret, results) => {
          if (error) {
            console.log(error)
          } else {
            twitter.verifyCredentials(
              accessToken,
              accessTokenSecret,
              {},
              (error, data, response) => {
                if (error) {
                  console.log(error)
                } else {
                  client.HMSET('access', { token: accessToken, tokenSecret: accessTokenSecret }, (error, result) => {
                    if (error) {
                      console.log(error)
                    } else {
                      res.send(data['screen_name'])
                    }
                  })
                }
              })
          }
        })
    }
  })
})

app.listen(process.env.PORT || 8080, () => console.log('listening ' + (process.env.PORT || 8080)))
