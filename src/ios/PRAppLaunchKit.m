//
//  PRAppLaunchKit.m
//  PRAppLaunchKit
//
//  Created by Vitali Bounine on 2015-03-10.
//  Copyright (c) 2015 NewspaperDirect. All rights reserved.
//

#import "PRAppLaunchKit.h"
#import <PressReader_SDK/PressReader.h>
#import <Cordova/CDV.h>

@implementation PRAppLaunchKit

- (void)launchPR:(CDVInvokedUrlCommand*)command
{
    [PRAppLaunchKit defaultAppLaunch].subscriptionKey = @"d9d261747f4148aaad4d13b670a24129"; //please get one from api.pressreader.com assigned to your account
    [self.launchButton setTitle:([[PRAppLaunchKit defaultAppLaunch] isAppInstalled] ? @"Open" : @"Install") forState:UIControlStateNormal];
}

- (void)viewDidLoad
{
    [super viewDidLoad];
	// Do any additional setup after loading the view, typically from a nib.
    self.durationTextField.enabled = NO;
    self.durationTextField.text = @"1";
    self.expirationCountdownLabel.hidden = YES;


}

- (BOOL)shouldAutorotateToInterfaceOrientation:(UIInterfaceOrientation)interfaceOrientation
{
    if ([[UIDevice currentDevice] userInterfaceIdiom] == UIUserInterfaceIdiomPhone) {
        return (interfaceOrientation != UIInterfaceOrientationPortraitUpsideDown);
    } else {
        return YES;
    }
}

- (IBAction)onStepperChanged:(UIStepper *)stepper
{
    self.durationTextField.text = [NSString stringWithFormat:@"%.0f", stepper.value];
}

- (IBAction)launchPR:(id)sender {
    NSDictionary * args = nil;
    if (self.giftIDTextField.text.length && self.secretTextField.text.length) {
        NSInteger siteID = self.siteIDTextField.text.integerValue ?: 8898;
        NSString *secret = self.secretTextField.text;
        NSString *giftID = self.giftIDTextField.text;
        NSInteger duration = [self.durationTextField.text integerValue];
        NSString *token = [self giftedJwtWithId:giftID siteID:siteID duration:duration tokenExpiration:24 signingSecret:secret];

        args = @{@"jwt": token};
    }

     [[PRAppLaunchKit defaultAppLaunch] launchAppWithCommand:@"register-gifted-access" URLParameters:args];
}

#pragma mark - Creating JWT utility methods

- (NSData *)HS256SignPayload:(NSString *)theString withSecret:(NSString *)theSecret;
{
    const char *cString = [theString cStringUsingEncoding:NSUTF8StringEncoding];
    const char *cSecret = [theSecret cStringUsingEncoding:NSUTF8StringEncoding];

    unsigned char cHMAC[CC_SHA256_DIGEST_LENGTH];
    CCHmac(kCCHmacAlgSHA256, cSecret, strlen(cSecret), cString, strlen(cString), cHMAC);
    return [NSData dataWithBytes:cHMAC length:sizeof(cHMAC)];
}

- (NSString *)giftedJwtWithId:(NSString *)issID siteID:(NSInteger)siteid duration:(NSInteger)accessH tokenExpiration:(NSInteger)tokenH signingSecret:(NSString *)secret
{
    NSString * header = @"{\"alg\": \"HS256\",\"typ\": \"JWT\"}";
    long now = lround([[NSDate date] timeIntervalSince1970]);
    NSDictionary * payload = @{@"iss":@"Qantas", @"jti":issID, @"iat":@(now), @"nbf":@(now-3600), @"exp":@(now + 3600 * tokenH), @"site-id":@(siteid), @"gift-period": @{@"num-hours":@(accessH)}};
    NSString *b64Header = [[[header dataUsingEncoding:NSUTF8StringEncoding] base64EncodedStringWithOptions:0] stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"="]];
    NSString *b64payload = [[[NSJSONSerialization dataWithJSONObject:payload options:0 error:NULL] base64EncodedStringWithOptions:0] stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"="]];
    NSString *signingInput = [@[b64Header, b64payload] componentsJoinedByString:@"."];
    NSString *signingOutput = [[[self HS256SignPayload:signingInput withSecret:secret] base64EncodedStringWithOptions:0] stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"="]];

    return [@[signingInput, signingOutput] componentsJoinedByString:@"."];
}

- (BOOL)textFieldShouldReturn:(UITextField *)textField
{
    [textField resignFirstResponder];
    return YES;
}

 
@end